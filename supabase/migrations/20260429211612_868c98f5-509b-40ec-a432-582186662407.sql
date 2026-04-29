
CREATE OR REPLACE FUNCTION public.get_pet_public_by_ref(_ref text)
RETURNS TABLE (
  id uuid, public_id text, owner_id uuid, name text,
  species pet_species, breed text, gender pet_gender, date_of_birth date,
  avatar_url text, bio text, city text,
  vaccination_verified boolean, discoverable_for_mating boolean,
  status_chip text, sire_pet_id uuid, dam_pet_id uuid, litter_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating,
         status_chip, sire_pet_id, dam_pet_id, litter_id
  FROM public.pets
  WHERE public_id = _ref OR id::text = _ref
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_profile_public_by_ref(_ref text)
RETURNS TABLE (
  id uuid, full_name text, avatar_url text, city text,
  bio text, handle text, cover_url text, account_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, city, bio, handle, cover_url, account_type::text
  FROM public.profiles
  WHERE handle = _ref OR id::text = _ref
  LIMIT 1
$$;

DROP FUNCTION IF EXISTS public.get_pets_public() CASCADE;

CREATE OR REPLACE FUNCTION public.get_pets_public()
RETURNS TABLE (
  id uuid, public_id text, owner_id uuid, name text,
  species pet_species, breed text, gender pet_gender, date_of_birth date,
  avatar_url text, bio text, city text,
  vaccination_verified boolean, discoverable_for_mating boolean,
  status_chip text, sire_pet_id uuid, dam_pet_id uuid, litter_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating,
         status_chip, sire_pet_id, dam_pet_id, litter_id
  FROM public.pets
$$;

CREATE VIEW public.pets_public WITH (security_invoker = on) AS
  SELECT * FROM public.get_pets_public();
