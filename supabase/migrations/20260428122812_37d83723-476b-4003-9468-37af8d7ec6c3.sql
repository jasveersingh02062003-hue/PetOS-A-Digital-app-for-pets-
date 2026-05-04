DROP FUNCTION public.get_pets_public();

CREATE FUNCTION public.get_pets_public()
RETURNS TABLE(
  id uuid,
  public_id text,
  owner_id uuid,
  name text,
  species pet_species,
  breed text,
  gender pet_gender,
  date_of_birth date,
  avatar_url text,
  bio text,
  city text,
  vaccination_verified boolean,
  discoverable_for_mating boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, public_id, owner_id, name, species::public.pet_species, breed, gender::public.pet_gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating
  FROM public.pets;
$function$;