
-- 1) Reaction notifications -------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_actor_name text;
  v_emoji text;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  v_emoji := CASE NEW.kind
    WHEN 'boop'   THEN '🐾'
    WHEN 'treat'  THEN '🦴'
    WHEN 'yummy'  THEN '😋'
    WHEN 'strong' THEN '💪'
    WHEN 'cute'   THEN '🥰'
    WHEN 'love'   THEN '❤️'
    WHEN 'paw'    THEN '🐾'
    WHEN 'laugh'  THEN '😂'
    WHEN 'wow'    THEN '😮'
    WHEN 'sad'    THEN '😢'
    ELSE '✨'
  END;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (
    v_author,
    NEW.user_id,
    'post_reaction',
    v_actor_name || ' ' || v_emoji || ' your post',
    NULL,
    '/post/' || NEW.post_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_reaction ON public.post_reactions;
CREATE TRIGGER trg_notify_post_reaction
AFTER INSERT ON public.post_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_post_reaction();

-- 2) Auto-milestone opt-in flag (defaults true) ----------------------------
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS auto_milestones boolean NOT NULL DEFAULT true;

-- 3) Dedup index for auto-posts --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_auto_milestone_key
  ON public.posts ((pet_snapshot->>'auto_milestone_key'))
  WHERE pet_snapshot ? 'auto_milestone_key';
