DO $$ BEGIN
  CREATE TYPE public.post_visibility AS ENUM ('public', 'followers', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility public.post_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS image_urls jsonb;

DROP POLICY IF EXISTS posts_select_all ON public.posts;

CREATE POLICY posts_select_visible ON public.posts
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR (
      visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.following_id = posts.author_id
      )
    )
  );