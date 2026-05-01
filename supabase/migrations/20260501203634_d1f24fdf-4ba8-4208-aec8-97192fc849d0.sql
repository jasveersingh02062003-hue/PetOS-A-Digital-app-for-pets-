
-- Phase 0: post kind enum
DO $$ BEGIN
  CREATE TYPE public.post_kind AS ENUM ('moment', 'milestone', 'memorial', 'tribe_post');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kind public.post_kind NOT NULL DEFAULT 'moment',
  ADD COLUMN IF NOT EXISTS pet_snapshot jsonb;

CREATE INDEX IF NOT EXISTS posts_kind_created_idx
  ON public.posts (kind, created_at DESC);

-- Trigger to populate pet_snapshot on insert/update of pet_id
CREATE OR REPLACE FUNCTION public.fill_post_pet_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet RECORD;
  v_age_months int;
  v_vaccines_ok boolean;
  v_city text;
BEGIN
  IF NEW.pet_id IS NULL THEN
    NEW.pet_snapshot := NULL;
    RETURN NEW;
  END IF;

  SELECT id, name, breed, dob, avatar_url, owner_id
    INTO v_pet
    FROM public.pets
   WHERE id = NEW.pet_id;

  IF v_pet IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_pet.dob IS NOT NULL THEN
    v_age_months := GREATEST(0, EXTRACT(YEAR FROM age(v_pet.dob))::int * 12
                                + EXTRACT(MONTH FROM age(v_pet.dob))::int);
  END IF;

  -- Best-effort vaccine OK: any health_record of kind 'vaccination' in last 12 months
  SELECT EXISTS (
    SELECT 1 FROM public.health_records hr
     WHERE hr.pet_id = v_pet.id
       AND hr.kind = 'vaccination'
       AND hr.created_at > now() - interval '365 days'
  ) INTO v_vaccines_ok;

  -- Owner city from profile (best-effort)
  SELECT city INTO v_city FROM public.profiles WHERE id = v_pet.owner_id;

  NEW.pet_snapshot := jsonb_build_object(
    'name', v_pet.name,
    'breed', v_pet.breed,
    'age_months', v_age_months,
    'avatar_url', v_pet.avatar_url,
    'vaccines_ok', COALESCE(v_vaccines_ok, false),
    'city', v_city
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_post_pet_snapshot ON public.posts;
CREATE TRIGGER trg_fill_post_pet_snapshot
  BEFORE INSERT OR UPDATE OF pet_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.fill_post_pet_snapshot();

-- Backfill existing posts (best-effort, ignores schema mismatch in optional columns)
DO $$
BEGIN
  UPDATE public.posts p
     SET pet_snapshot = jsonb_build_object(
           'name', pe.name,
           'breed', pe.breed,
           'age_months', CASE WHEN pe.dob IS NOT NULL
                              THEN GREATEST(0, EXTRACT(YEAR FROM age(pe.dob))::int * 12
                                              + EXTRACT(MONTH FROM age(pe.dob))::int)
                              ELSE NULL END,
           'avatar_url', pe.avatar_url,
           'vaccines_ok', false,
           'city', NULL
         )
    FROM public.pets pe
   WHERE p.pet_id = pe.id
     AND p.pet_snapshot IS NULL;
EXCEPTION WHEN OTHERS THEN
  -- non-fatal
  NULL;
END $$;

-- Phase 2 prep: extend reaction kinds
ALTER TABLE public.post_reactions
  DROP CONSTRAINT IF EXISTS post_reactions_kind_check;

ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_kind_check
  CHECK (kind IN ('love','paw','laugh','wow','sad','boop','treat','yummy','strong','cute'));
