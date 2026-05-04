-- Phase 3: Privacy & Hardening

-- 1. PETS table: tighten read access
DROP POLICY IF EXISTS pets_select_all ON public.pets;

CREATE POLICY pets_select_scoped ON public.pets
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR discoverable_for_mating = true
  OR EXISTS (SELECT 1 FROM public.posts po WHERE po.pet_id = pets.id)
  OR EXISTS (
    SELECT 1 FROM public.mating_requests mr
    WHERE (mr.from_pet_id = pets.id OR mr.to_pet_id = pets.id)
      AND (auth.uid() = mr.from_owner_id OR auth.uid() = mr.to_owner_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.vet_consults vc
    WHERE vc.pet_id = pets.id
      AND (auth.uid() = vc.owner_id OR auth.uid() = vc.vet_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.service_bookings sb
    WHERE sb.pet_id = pets.id
      AND (
        auth.uid() = sb.customer_id
        OR EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id = sb.provider_id AND sp.owner_id = auth.uid())
      )
  )
);

-- 2. PROFILES table: owner-only full read; others use the public view
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Public projection (safe fields only) via SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_profiles_public()
RETURNS TABLE (id uuid, full_name text, avatar_url text, city text, bio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, city, bio FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated;

DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public AS
SELECT * FROM public.get_profiles_public();
GRANT SELECT ON public.profiles_public TO authenticated;

-- Public pet projection
CREATE OR REPLACE FUNCTION public.get_pets_public()
RETURNS TABLE (
  id uuid, owner_id uuid, name text, species pet_species, breed text,
  gender pet_gender, avatar_url text, bio text, city text,
  vaccination_verified boolean, discoverable_for_mating boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, owner_id, name, species::public.pet_species, breed, gender::public.pet_gender, avatar_url, bio, city,
         vaccination_verified, discoverable_for_mating
  FROM public.pets;
$$;
REVOKE ALL ON FUNCTION public.get_pets_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated;

DROP VIEW IF EXISTS public.pets_public CASCADE;
CREATE VIEW public.pets_public AS
SELECT * FROM public.get_pets_public();
GRANT SELECT ON public.pets_public TO authenticated;

-- 3. notify_user honors notif_prefs.push
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _body text, _link text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_push boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE((notif_prefs->>'push')::boolean, true) INTO v_push
  FROM public.profiles WHERE id = _user_id;
  IF v_push IS false THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END $$;