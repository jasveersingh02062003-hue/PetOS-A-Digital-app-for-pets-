CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'search',
  q TEXT NOT NULL DEFAULT '',
  tab TEXT NOT NULL DEFAULT 'all',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id, created_at DESC);
CREATE UNIQUE INDEX uq_saved_searches_dedupe
  ON public.saved_searches(user_id, scope, lower(coalesce(q,'')), tab, md5(filters::text));

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saved searches"
  ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own saved searches"
  ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own saved searches"
  ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own saved searches"
  ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();