CREATE TABLE public.post_hashtags (
  post_id uuid NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX idx_post_hashtags_tag ON public.post_hashtags(tag, created_at DESC);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hashtags_select_all" ON public.post_hashtags FOR SELECT TO authenticated USING (true);
CREATE POLICY "hashtags_insert_author" ON public.post_hashtags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
CREATE POLICY "hashtags_delete_author" ON public.post_hashtags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_post_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m text[];
BEGIN
  DELETE FROM public.post_hashtags WHERE post_id = NEW.id;
  IF NEW.caption IS NULL OR length(NEW.caption) = 0 THEN
    RETURN NEW;
  END IF;
  FOR m IN
    SELECT regexp_matches(NEW.caption, '#([A-Za-z0-9_]{2,30})', 'g')
  LOOP
    INSERT INTO public.post_hashtags (post_id, tag) VALUES (NEW.id, lower(m[1]))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_post_hashtags
  AFTER INSERT OR UPDATE OF caption ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

UPDATE public.posts SET caption = caption WHERE caption IS NOT NULL;

CREATE OR REPLACE VIEW public.trending_hashtags AS
SELECT tag, count(*)::int AS post_count, max(created_at) AS last_used
FROM public.post_hashtags
WHERE created_at > now() - interval '24 hours'
GROUP BY tag
ORDER BY post_count DESC, last_used DESC
LIMIT 20;

GRANT SELECT ON public.trending_hashtags TO authenticated;