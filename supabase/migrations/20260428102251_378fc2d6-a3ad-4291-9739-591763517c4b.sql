CREATE TABLE public.follows (
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select_all ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  pet_id UUID,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  view_count INT NOT NULL DEFAULT 0
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY stories_select_active ON public.stories FOR SELECT TO authenticated USING (expires_at > now() OR author_id = auth.uid());
CREATE POLICY stories_insert_own ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY stories_delete_own ON public.stories FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE INDEX idx_stories_author_expires ON public.stories(author_id, expires_at DESC);
CREATE INDEX idx_stories_expires ON public.stories(expires_at DESC);

CREATE TABLE public.story_views (
  story_id UUID NOT NULL,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_views_insert_own ON public.story_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY story_views_select_party ON public.story_views FOR SELECT TO authenticated USING (
  auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.author_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.bump_story_view()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bump_story_view AFTER INSERT ON public.story_views FOR EACH ROW EXECUTE FUNCTION public.bump_story_view();

CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_id UUID,
  kind TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pet_id, kind)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievements_select_all ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_achievements_user ON public.achievements(user_id);

CREATE OR REPLACE FUNCTION public.on_new_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.notify_user(NEW.following_id, 'new_follower',
    'New follower',
    COALESCE(v_name, 'Someone') || ' started following you',
    '/u/' || NEW.follower_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_new_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.on_new_follow();

CREATE OR REPLACE FUNCTION public.award_first_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.achievements (user_id, kind) VALUES (NEW.author_id, 'first_post')
  ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_award_first_post AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.award_first_post();

INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Stories publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Users upload own stories" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own stories" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;