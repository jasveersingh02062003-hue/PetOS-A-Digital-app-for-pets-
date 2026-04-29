-- ===========================================================
-- P4 — GPS Tracker (software side)
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.gps_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Tracker',
  device_type text NOT NULL DEFAULT 'phone'
    CHECK (device_type IN ('collar','airtag','phone','other')),
  pairing_code text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)),
  battery_pct int,
  last_seen_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_devices_pet ON public.gps_devices(pet_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_owner ON public.gps_devices(owner_id);

ALTER TABLE public.gps_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY gps_devices_owner_all ON public.gps_devices
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Pings
CREATE TABLE IF NOT EXISTS public.gps_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy_m numeric,
  battery_pct int,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  outside_geofence boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_pings_device_time ON public.gps_pings(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_pings_pet_time ON public.gps_pings(pet_id, recorded_at DESC);

ALTER TABLE public.gps_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY gps_pings_owner_select ON public.gps_pings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gps_devices d WHERE d.id = gps_pings.device_id AND d.owner_id = auth.uid()
  ));

-- Geofences
CREATE TABLE IF NOT EXISTS public.geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Home',
  center_lat numeric NOT NULL,
  center_lng numeric NOT NULL,
  radius_m int NOT NULL DEFAULT 200 CHECK (radius_m BETWEEN 50 AND 5000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_pet ON public.geofences(pet_id);

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY geofences_owner_all ON public.geofences
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ===========================================================
-- Ingest RPC: hardware (or phone) pushes pings via pairing code
-- ===========================================================
CREATE OR REPLACE FUNCTION public.ingest_gps_ping(
  _pairing_code text,
  _lat numeric,
  _lng numeric,
  _accuracy_m numeric DEFAULT NULL,
  _battery_pct int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  ping_id uuid;
BEGIN
  SELECT * INTO d FROM public.gps_devices WHERE pairing_code = _pairing_code AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or inactive pairing code'; END IF;

  INSERT INTO public.gps_pings(device_id, pet_id, lat, lng, accuracy_m, battery_pct)
  VALUES (d.id, d.pet_id, _lat, _lng, _accuracy_m, _battery_pct)
  RETURNING id INTO ping_id;

  UPDATE public.gps_devices
  SET last_seen_at = now(),
      battery_pct = COALESCE(_battery_pct, battery_pct),
      updated_at = now()
  WHERE id = d.id;

  RETURN ping_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_gps_ping(text, numeric, numeric, numeric, int) TO authenticated, anon;

-- ===========================================================
-- Geofence breach trigger
-- ===========================================================
CREATE OR REPLACE FUNCTION public.tg_check_geofence_breach()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_fences boolean;
  inside boolean;
  owner uuid;
  pet_name text;
BEGIN
  SELECT owner_id INTO owner FROM public.gps_devices WHERE id = NEW.device_id;

  SELECT EXISTS (SELECT 1 FROM public.geofences WHERE pet_id = NEW.pet_id AND active)
    INTO has_fences;
  IF NOT has_fences THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.geofences g
    WHERE g.pet_id = NEW.pet_id AND g.active
      AND earth_distance(ll_to_earth(NEW.lat, NEW.lng),
                         ll_to_earth(g.center_lat, g.center_lng)) <= g.radius_m
  ) INTO inside;

  IF NOT inside THEN
    NEW.outside_geofence := true;
    SELECT name INTO pet_name FROM public.pets WHERE id = NEW.pet_id;
    PERFORM public.notify_user(
      owner, 'geofence',
      COALESCE(pet_name,'Your pet') || ' left their safe zone',
      'Tap to view live location.',
      '/pets/' || NEW.pet_id::text || '/tracker'
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gps_geofence_breach ON public.gps_pings;
CREATE TRIGGER trg_gps_geofence_breach
  BEFORE INSERT ON public.gps_pings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_check_geofence_breach();

-- Enable realtime for live tracking
ALTER TABLE public.gps_pings REPLICA IDENTITY FULL;
ALTER TABLE public.gps_devices REPLICA IDENTITY FULL;