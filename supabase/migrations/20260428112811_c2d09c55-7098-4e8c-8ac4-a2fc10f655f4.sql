-- 1) Public share token on service_bookings
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS public_share_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.service_bookings SET public_share_token = gen_random_uuid()
  WHERE public_share_token IS NULL;

-- 2) Public RPC: get walk tracks + minimal booking info by token
CREATE OR REPLACE FUNCTION public.get_public_walk(_token uuid)
RETURNS TABLE(
  booking_id uuid,
  status text,
  provider_name text,
  pet_name text,
  scheduled_at timestamptz,
  tracks jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT sb.id, sb.status::text, sb.scheduled_at, sb.provider_id, sb.pet_id
    FROM public.service_bookings sb
    WHERE sb.public_share_token = _token
    LIMIT 1
  )
  SELECT
    b.id,
    b.status,
    (SELECT name FROM public.service_providers WHERE id = b.provider_id),
    (SELECT name FROM public.pets WHERE id = b.pet_id),
    b.scheduled_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('lat', wt.lat, 'lng', wt.lng, 'recorded_at', wt.recorded_at)
                       ORDER BY wt.recorded_at)
      FROM public.walk_tracks wt
      WHERE wt.booking_id = b.id
    ), '[]'::jsonb)
  FROM b;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_walk(uuid) TO anon, authenticated;

-- 3) Replace missing pet notify trigger with radius-aware version (city OR within 5km)
CREATE OR REPLACE FUNCTION public.notify_missing_pet_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet_name text;
  v_species text;
  rec RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT name, species::text INTO v_pet_name, v_species FROM public.pets WHERE id = NEW.pet_id;

  FOR rec IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.id <> NEW.owner_id
      AND (
        (NEW.last_seen_city IS NOT NULL AND lower(p.city) = lower(NEW.last_seen_city))
        OR (
          NEW.last_seen_lat IS NOT NULL AND NEW.last_seen_lng IS NOT NULL
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          AND earth_distance(ll_to_earth(NEW.last_seen_lat, NEW.last_seen_lng), ll_to_earth(p.lat, p.lng)) <= 5000
        )
      )
    LIMIT 5000
  LOOP
    PERFORM public.notify_user(
      rec.id,
      'missing_pet',
      'Help find ' || COALESCE(v_pet_name, 'a pet'),
      COALESCE(v_species, 'pet') || ' last seen near ' || COALESCE(NEW.last_seen_city, 'your area'),
      '/missing/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;

-- 4) Realtime publication safety
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_tracks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Add lat/lng to profiles if not present (safety; may already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng numeric;
