-- Extend public RPCs to expose new profile + pet fields
DROP VIEW IF EXISTS public.profiles_public CASCADE;
DROP VIEW IF EXISTS public.pets_public CASCADE;
DROP FUNCTION IF EXISTS public.get_profiles_public();
DROP FUNCTION IF EXISTS public.get_pets_public();

CREATE FUNCTION public.get_profiles_public()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  bio text,
  handle text,
  cover_url text,
  account_type public.account_type
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, city, bio, handle, cover_url, account_type
  FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated;

CREATE VIEW public.profiles_public AS SELECT * FROM public.get_profiles_public();
GRANT SELECT ON public.profiles_public TO authenticated;

CREATE FUNCTION public.get_pets_public()
RETURNS TABLE (
  id uuid,
  public_id text,
  owner_id uuid,
  name text,
  species public.pet_species,
  breed text,
  gender public.pet_gender,
  date_of_birth date,
  avatar_url text,
  bio text,
  city text,
  vaccination_verified boolean,
  discoverable_for_mating boolean,
  status_chip text,
  sire_pet_id uuid,
  dam_pet_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating,
         status_chip, sire_pet_id, dam_pet_id
  FROM public.pets;
$$;
REVOKE ALL ON FUNCTION public.get_pets_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated;

CREATE VIEW public.pets_public AS SELECT * FROM public.get_pets_public();
GRANT SELECT ON public.pets_public TO authenticated;

-- Step 2 schema: litter_pets join table for the litter wizard
CREATE TABLE IF NOT EXISTS public.litter_pets (
  litter_id uuid NOT NULL REFERENCES public.litter_groups(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (litter_id, pet_id)
);

ALTER TABLE public.litter_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "litter_pets_select_all"
  ON public.litter_pets FOR SELECT TO authenticated USING (true);

CREATE POLICY "litter_pets_insert_owner"
  ON public.litter_pets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.litter_groups l WHERE l.id = litter_id AND l.created_by = auth.uid()));

CREATE POLICY "litter_pets_delete_owner"
  ON public.litter_pets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.litter_groups l WHERE l.id = litter_id AND l.created_by = auth.uid()));