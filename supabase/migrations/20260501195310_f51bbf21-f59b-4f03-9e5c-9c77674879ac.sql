-- Add a _force flag to seed_pet_vaccine_reminders so users can recalc auto-scheduled
-- vaccine rows after correcting a pet's age/DOB. Auto-rows are matched by their
-- distinctive notes prefix written at insert time.
CREATE OR REPLACE FUNCTION public.seed_pet_vaccine_reminders(_pet_id uuid, _force boolean DEFAULT false)
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
  v_owner uuid;
BEGIN
  SELECT species, COALESCE(date_of_birth, CURRENT_DATE), owner_id
    INTO v_species, v_dob, v_owner
  FROM public.pets WHERE id = _pet_id;

  IF v_species IS NULL THEN RETURN; END IF;
  -- Only the owner (or a service role) should be able to (re)seed.
  IF v_owner IS DISTINCT FROM auth.uid() THEN RETURN; END IF;

  IF _force THEN
    DELETE FROM public.vaccinations
    WHERE pet_id = _pet_id
      AND notes LIKE 'Auto-scheduled%';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.seed_pet_vaccine_reminders(uuid, boolean) TO authenticated;