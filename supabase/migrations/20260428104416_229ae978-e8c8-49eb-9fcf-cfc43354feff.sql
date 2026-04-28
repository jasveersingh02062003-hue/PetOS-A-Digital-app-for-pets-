-- ============================================
-- Phase 4: Daily Pet Moment + Collab Posts
-- ============================================

-- =============== DAILY MOMENTS ===============
CREATE TABLE public.daily_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_date date NOT NULL UNIQUE,
  prompt_text text NOT NULL,
  dropped_at timestamptz NOT NULL DEFAULT now(),
  window_minutes integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_prompts_select_all ON public.daily_prompts FOR SELECT TO authenticated USING (true);

CREATE TABLE public.daily_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.daily_prompts(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  on_time boolean NOT NULL DEFAULT false,
  late_minutes integer NOT NULL DEFAULT 0,
  UNIQUE (prompt_id, user_id)
);
CREATE INDEX idx_daily_moments_prompt ON public.daily_moments(prompt_id);
CREATE INDEX idx_daily_moments_user ON public.daily_moments(user_id);
ALTER TABLE public.daily_moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_moments_select_all ON public.daily_moments FOR SELECT TO authenticated USING (true);
CREATE POLICY daily_moments_insert_own ON public.daily_moments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
CREATE POLICY daily_moments_delete_own ON public.daily_moments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.daily_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_posted_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_streaks_select_all ON public.daily_streaks FOR SELECT TO authenticated USING (true);

-- Trigger: on daily_moment insert, compute on_time and update streak
CREATE OR REPLACE FUNCTION public.on_daily_moment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dropped timestamptz;
  v_window int;
  v_date date;
  v_diff_min int;
  v_streak int;
  v_last date;
  v_longest int;
BEGIN
  SELECT dropped_at, window_minutes, prompt_date INTO v_dropped, v_window, v_date
    FROM public.daily_prompts WHERE id = NEW.prompt_id;
  v_diff_min := GREATEST(0, EXTRACT(EPOCH FROM (NEW.posted_at - v_dropped))/60)::int;
  NEW.on_time := v_diff_min <= v_window;
  NEW.late_minutes := GREATEST(0, v_diff_min - v_window);

  -- Streak update
  SELECT current_streak, last_posted_date, longest_streak
    INTO v_streak, v_last, v_longest
    FROM public.daily_streaks WHERE user_id = NEW.user_id;

  IF v_last IS NULL THEN
    v_streak := 1;
  ELSIF v_last = v_date THEN
    -- already posted today (shouldn't happen due to UNIQUE)
    v_streak := COALESCE(v_streak, 1);
  ELSIF v_last = v_date - 1 THEN
    v_streak := COALESCE(v_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;
  v_longest := GREATEST(COALESCE(v_longest, 0), v_streak);

  INSERT INTO public.daily_streaks (user_id, current_streak, longest_streak, last_posted_date, updated_at)
  VALUES (NEW.user_id, v_streak, v_longest, v_date, now())
  ON CONFLICT (user_id) DO UPDATE
    SET current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        last_posted_date = EXCLUDED.last_posted_date,
        updated_at = now();

  -- Award badges
  INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'daily_moment_first')
    ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  IF v_streak >= 7 THEN
    INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'daily_streak_7')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;
  IF v_streak >= 30 THEN
    INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'daily_streak_30')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_daily_moment_insert
BEFORE INSERT ON public.daily_moments
FOR EACH ROW EXECUTE FUNCTION public.on_daily_moment_insert();

-- =============== COLLAB POSTS ===============
CREATE TYPE public.collab_status AS ENUM ('pending','accepted','declined');

CREATE TABLE public.post_collaborators (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pet_id uuid,
  status public.collab_status NOT NULL DEFAULT 'pending',
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_collab_user_status ON public.post_collaborators(user_id, status);
CREATE INDEX idx_collab_post ON public.post_collaborators(post_id);

ALTER TABLE public.post_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select_visible ON public.post_collaborators FOR SELECT TO authenticated
  USING (
    status = 'accepted'
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

CREATE POLICY pc_insert_author ON public.post_collaborators FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

CREATE POLICY pc_update_invitee ON public.post_collaborators FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY pc_delete_author_or_self ON public.post_collaborators FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

-- Triggers: notify on invite + acceptance
CREATE OR REPLACE FUNCTION public.on_collab_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author_name text;
BEGIN
  SELECT pr.full_name INTO v_author_name
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE p.id = NEW.post_id;
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.notify_user(NEW.user_id, 'collab_invite',
      COALESCE(v_author_name, 'Someone') || ' tagged you in a post',
      'Tap to accept and add it to your profile.',
      '/u/' || NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_collab_invite AFTER INSERT ON public.post_collaborators
FOR EACH ROW EXECUTE FUNCTION public.on_collab_invite();

CREATE OR REPLACE FUNCTION public.on_collab_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid; v_user_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','declined') THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
    NEW.responded_at := now();
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      PERFORM public.notify_user(v_author,
        CASE WHEN NEW.status = 'accepted' THEN 'collab_accepted' ELSE 'collab_declined' END,
        COALESCE(v_user_name, 'Someone') || ' ' || NEW.status::text || ' your collab',
        NULL,
        '/');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_collab_response BEFORE UPDATE ON public.post_collaborators
FOR EACH ROW EXECUTE FUNCTION public.on_collab_response();