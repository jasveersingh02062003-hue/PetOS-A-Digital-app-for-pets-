-- 1) Add boost expiry column
ALTER TABLE public.missing_pets
  ADD COLUMN IF NOT EXISTS boosted_until timestamptz;

CREATE INDEX IF NOT EXISTS missing_pets_boosted_until_idx
  ON public.missing_pets (boosted_until)
  WHERE boosted_until IS NOT NULL;

-- 2) Update fan-out trigger to widen radius for boosted listings
CREATE OR REPLACE FUNCTION public.notify_missing_pet_alerts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pet_name text;
  v_species text;
  v_radius_m integer;
  v_boosted boolean;
  rec RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT name, species::text INTO v_pet_name, v_species FROM public.pets WHERE id = NEW.pet_id;

  v_boosted := (NEW.boosted_until IS NOT NULL AND NEW.boosted_until > now());
  v_radius_m := CASE WHEN v_boosted THEN 15000 ELSE 5000 END;

  FOR rec IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.id <> NEW.owner_id
      AND (
        (NEW.last_seen_city IS NOT NULL AND lower(p.city) = lower(NEW.last_seen_city))
        OR (
          NEW.last_seen_lat IS NOT NULL AND NEW.last_seen_lng IS NOT NULL
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          AND earth_distance(ll_to_earth(NEW.last_seen_lat, NEW.last_seen_lng), ll_to_earth(p.lat, p.lng)) <= v_radius_m
        )
      )
    LIMIT 5000
  LOOP
    PERFORM public.notify_user(
      rec.id,
      'missing_pet',
      CASE WHEN v_boosted THEN '⭐ Help find ' ELSE 'Help find ' END || COALESCE(v_pet_name, 'a pet'),
      COALESCE(v_species, 'pet') || ' last seen near ' || COALESCE(NEW.last_seen_city, 'your area'),
      '/missing/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END $function$;

-- 3) Expiry function for daily cron
CREATE OR REPLACE FUNCTION public.expire_missing_pet_boosts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.missing_pets
       SET boosted_until = NULL
     WHERE boosted_until IS NOT NULL
       AND boosted_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_missing_pet_boosts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_missing_pet_boosts() TO service_role;