-- Pet Parent Onboarding extensions
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS approx_age_months integer;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_prefs jsonb NOT NULL DEFAULT
    '{"vaccines": true, "deworming": true, "flea_tick": true, "checkup": true}'::jsonb;

-- Trigger: derive date_of_birth from approx_age_months when DOB not provided.
CREATE OR REPLACE FUNCTION public.pets_derive_dob()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NULL AND NEW.approx_age_months IS NOT NULL AND NEW.approx_age_months >= 0 THEN
    NEW.date_of_birth := (CURRENT_DATE - (NEW.approx_age_months || ' months')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pets_derive_dob_trg ON public.pets;
CREATE TRIGGER pets_derive_dob_trg
BEFORE INSERT OR UPDATE ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.pets_derive_dob();

-- Helper: seed a default vaccination schedule for a pet (only if none exist yet).
-- Schedules core vaccines as "due rows" with a NULL administered_on is not allowed,
-- so we instead insert future-dated rows using administered_on=DOB and next_due_on=DOB+offset.
-- For simplicity we insert one synthetic "scheduled" row per vaccine using today as administered_on=NULL...
-- Since administered_on is NOT NULL, we instead just create next_due_on entries via a dedicated table?
-- Simplest: insert vaccinations rows representing the FIRST due dose with administered_on = COALESCE(DOB, today)
-- and next_due_on set to the next due date. Owner can correct/delete later.
CREATE OR REPLACE FUNCTION public.seed_pet_vaccine_reminders(_pet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_species pet_species;
  v_dob date;
  v_base date;
  v_count int;
BEGIN
  SELECT species, COALESCE(date_of_birth, CURRENT_DATE)
    INTO v_species, v_dob
  FROM public.pets WHERE id = _pet_id;

  IF v_species IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_count FROM public.vaccinations WHERE pet_id = _pet_id;
  IF v_count > 0 THEN RETURN; END IF;

  v_base := GREATEST(v_dob, CURRENT_DATE);

  IF v_species = 'dog' THEN
    INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, notes)
    VALUES
      (_pet_id, 'DHPP (annual)',  v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup — edit if your pet has had this'),
      (_pet_id, 'Rabies (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup — edit if your pet has had this'),
      (_pet_id, 'Deworming',       v_base, v_base + INTERVAL '90 days',  'Auto-scheduled — every 3 months');
  ELSIF v_species = 'cat' THEN
    INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, notes)
    VALUES
      (_pet_id, 'FVRCP (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup'),
      (_pet_id, 'Rabies (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup'),
      (_pet_id, 'Deworming',       v_base, v_base + INTERVAL '90 days',  'Auto-scheduled — every 3 months');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_pet_vaccine_reminders(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_pet_vaccine_reminders(uuid) TO authenticated;

-- Avatars bucket for profile photos (pet-avatars already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read') THEN
    CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_write') THEN
    CREATE POLICY "avatars_owner_write" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_update') THEN
    CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_delete') THEN
    CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;