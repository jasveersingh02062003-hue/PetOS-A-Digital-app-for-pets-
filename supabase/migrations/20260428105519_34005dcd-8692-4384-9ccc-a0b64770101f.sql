-- 1. Reactions table
CREATE TABLE public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('love','paw','laugh','wow','sad')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, kind)
);
CREATE INDEX idx_post_reactions_post ON public.post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON public.post_reactions(user_id);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select_all" ON public.post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert_own" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete_own" ON public.post_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Reaction counts on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.bump_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post uuid;
  v_kind text;
  v_delta int;
  v_current jsonb;
  v_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_post := NEW.post_id; v_kind := NEW.kind; v_delta := 1;
  ELSE
    v_post := OLD.post_id; v_kind := OLD.kind; v_delta := -1;
  END IF;

  SELECT reaction_counts INTO v_current FROM public.posts WHERE id = v_post FOR UPDATE;
  v_count := COALESCE((v_current->>v_kind)::int, 0) + v_delta;
  IF v_count < 0 THEN v_count := 0; END IF;
  UPDATE public.posts
    SET reaction_counts = COALESCE(v_current, '{}'::jsonb) || jsonb_build_object(v_kind, v_count)
    WHERE id = v_post;

  -- Keep legacy like_count in sync with total reactions for compatibility
  UPDATE public.posts SET like_count = (
    SELECT COALESCE(SUM((value)::int), 0)
    FROM jsonb_each_text(reaction_counts)
  ) WHERE id = v_post;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_bump_reaction_counts
  AFTER INSERT OR DELETE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.bump_reaction_counts();

-- 3. Notification on new reaction (reuse existing notify_user)
CREATE OR REPLACE FUNCTION public.on_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    PERFORM public.notify_user(v_author, 'post_reaction',
      'Someone reacted to your post', NULL, '/');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_post_reaction_notify
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.on_post_reaction();

-- 4. Backfill existing likes as 'love' reactions
INSERT INTO public.post_reactions (post_id, user_id, kind, created_at)
SELECT post_id, user_id, 'love', created_at FROM public.post_likes
ON CONFLICT (post_id, user_id, kind) DO NOTHING;

-- 5. Realtime
ALTER TABLE public.post_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;