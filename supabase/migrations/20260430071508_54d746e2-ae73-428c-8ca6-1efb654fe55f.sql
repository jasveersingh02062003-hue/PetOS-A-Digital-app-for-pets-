-- 1) Allow anonymous sightings: make reporter_id nullable + add anon session id
ALTER TABLE public.missing_pet_sightings
  ALTER COLUMN reporter_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS anon_session_id text;

-- Drop old strict insert policy and recreate two policies (auth + anon)
DROP POLICY IF EXISTS sightings_insert_signed_in ON public.missing_pet_sightings;

CREATE POLICY sightings_insert_authed ON public.missing_pet_sightings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.status = 'active'
  )
);

CREATE POLICY sightings_insert_anon ON public.missing_pet_sightings
FOR INSERT TO anon
WITH CHECK (
  reporter_id IS NULL
  AND anon_session_id IS NOT NULL
  AND length(anon_session_id) BETWEEN 8 AND 128
  AND EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.status = 'active'
  )
);

-- Allow pet owner to also see anonymous sightings (existing select policy already covers owner)
-- Add an explicit allow for anonymous reporter to read their own (by session) — kept minimal to avoid leakage
CREATE POLICY sightings_select_owner_public ON public.missing_pet_sightings
FOR SELECT TO anon
USING (false);

-- 2) Anon rate limit trigger: max 5 sightings / hour / session
CREATE OR REPLACE FUNCTION public.enforce_anon_sighting_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.reporter_id IS NULL AND NEW.anon_session_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.missing_pet_sightings
    WHERE anon_session_id = NEW.anon_session_id
      AND created_at > now() - interval '1 hour';
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_anon_sighting_rate_limit ON public.missing_pet_sightings;
CREATE TRIGGER trg_anon_sighting_rate_limit
BEFORE INSERT ON public.missing_pet_sightings
FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_sighting_rate_limit();

-- 3) Intent events table — universal funnel telemetry + replay state
CREATE TABLE IF NOT EXISTS public.intent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  anon_session_id text,
  kind text NOT NULL CHECK (kind IN (
    'contact_seller','book_service','donate','apply_to_adopt',
    'taxi_post','subscribe_missing_alert','shop_checkout','vet_book','report_sighting'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  redirect text,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','phone')),
  identifier text, -- email address or phone in E.164
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_events_user ON public.intent_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_events_anon ON public.intent_events(anon_session_id, created_at DESC);

ALTER TABLE public.intent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY intent_events_insert_anyone ON public.intent_events
FOR INSERT TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL AND anon_session_id IS NOT NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

CREATE POLICY intent_events_select_own ON public.intent_events
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY intent_events_update_own ON public.intent_events
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());