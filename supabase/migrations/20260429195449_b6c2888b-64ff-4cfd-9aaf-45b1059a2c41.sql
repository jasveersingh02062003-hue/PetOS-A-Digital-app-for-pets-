CREATE TABLE IF NOT EXISTS public.rescue_journeys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id      UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  cover_url   TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL DEFAULT 'in_care'
              CHECK (status IN ('in_care', 'adopted', 'rip')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rescue_journeys_org    ON public.rescue_journeys(org_id);
CREATE INDEX IF NOT EXISTS idx_rescue_journeys_status ON public.rescue_journeys(status);

ALTER TABLE public.rescue_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rescue journeys"
  ON public.rescue_journeys FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Only shelters/rescuers create their own journeys"
  ON public.rescue_journeys FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('shelter', 'rescuer', 'sanctuary')
    )
  );

CREATE POLICY "Owner updates own journeys"
  ON public.rescue_journeys FOR UPDATE TO authenticated
  USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());

CREATE POLICY "Owner deletes own journeys"
  ON public.rescue_journeys FOR DELETE TO authenticated
  USING (org_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.rescue_journey_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id  UUID NOT NULL REFERENCES public.rescue_journeys(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  day_number  INT NOT NULL,
  image_url   TEXT,
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rescue_journey_entries_journey
  ON public.rescue_journey_entries(journey_id, day_number);

ALTER TABLE public.rescue_journey_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view journey entries"
  ON public.rescue_journey_entries FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Owner inserts entries on own journey"
  ON public.rescue_journey_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rescue_journeys j
      WHERE j.id = journey_id AND j.org_id = auth.uid()
    )
  );

CREATE POLICY "Owner updates own journey entries"
  ON public.rescue_journey_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rescue_journeys j
      WHERE j.id = journey_id AND j.org_id = auth.uid()
    )
  );

CREATE POLICY "Owner deletes own journey entries"
  ON public.rescue_journey_entries FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rescue_journeys j
      WHERE j.id = journey_id AND j.org_id = auth.uid()
    )
  );

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS rescue_journey_id UUID
  REFERENCES public.rescue_journeys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_rescue_journey
  ON public.posts(rescue_journey_id) WHERE rescue_journey_id IS NOT NULL;

DROP TRIGGER IF EXISTS tg_rescue_journeys_set_updated_at ON public.rescue_journeys;
CREATE TRIGGER tg_rescue_journeys_set_updated_at
  BEFORE UPDATE ON public.rescue_journeys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_rescue_journey_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j_started TIMESTAMPTZ;
  j_owner   UUID;
  d_num     INT;
BEGIN
  IF NEW.rescue_journey_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT started_at, org_id INTO j_started, j_owner
  FROM public.rescue_journeys
  WHERE id = NEW.rescue_journey_id;

  IF j_started IS NULL THEN
    RETURN NEW;
  END IF;

  IF j_owner <> NEW.author_id THEN
    RETURN NEW;
  END IF;

  d_num := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (now() - j_started)) / 86400)::INT + 1);

  INSERT INTO public.rescue_journey_entries (journey_id, post_id, day_number, image_url, caption)
  VALUES (
    NEW.rescue_journey_id,
    NEW.id,
    d_num,
    COALESCE(NEW.image_url_feed, NEW.image_url),
    NEW.caption
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_posts_rescue_journey_entry ON public.posts;
CREATE TRIGGER tg_posts_rescue_journey_entry
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.create_rescue_journey_entry();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rescue_journey_entries;