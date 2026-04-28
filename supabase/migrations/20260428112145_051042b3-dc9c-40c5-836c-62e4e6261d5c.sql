CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

ALTER TABLE public.pets        ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric;

CREATE INDEX IF NOT EXISTS pets_geo_idx ON public.pets USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS providers_geo_idx ON public.service_providers USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS vet_profiles_geo_idx ON public.vet_profiles USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS meetups_geo_idx ON public.meetups USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS missing_geo_idx ON public.missing_pets USING gist (ll_to_earth(last_seen_lat, last_seen_lng)) WHERE last_seen_lat IS NOT NULL AND last_seen_lng IS NOT NULL;

CREATE OR REPLACE FUNCTION public.nearby_providers(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 25, _category text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, category text, lat numeric, lng numeric, city text, cover_url text, hourly_rate_inr int, verified boolean, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sp.id, sp.name, sp.category::text, sp.lat, sp.lng, sp.city, sp.cover_url, sp.hourly_rate_inr, sp.verified,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(sp.lat, sp.lng))/1000)::numeric AS distance_km
  FROM public.service_providers sp
  WHERE sp.lat IS NOT NULL AND sp.lng IS NOT NULL AND sp.active = true
    AND (_category IS NULL OR sp.category::text = _category)
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(sp.lat, sp.lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(sp.lat, sp.lng)) <= _radius_km*1000
  ORDER BY distance_km ASC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.nearby_vets(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 25)
RETURNS TABLE (user_id uuid, display_name text, clinic_name text, photo_url text, lat numeric, lng numeric, city text, price_video_inr int, rating_avg numeric, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vp.user_id, vp.display_name, vp.clinic_name, vp.photo_url, vp.lat, vp.lng, vp.city, vp.price_video_inr, vp.rating_avg,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(vp.lat, vp.lng))/1000)::numeric
  FROM public.vet_profiles vp
  WHERE vp.lat IS NOT NULL AND vp.lng IS NOT NULL AND vp.active = true AND vp.onboarded = true
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(vp.lat, vp.lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(vp.lat, vp.lng)) <= _radius_km*1000
  ORDER BY 10 ASC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.nearby_missing(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 50)
RETURNS TABLE (id uuid, pet_id uuid, photo_url text, lat numeric, lng numeric, city text, last_seen_at timestamptz, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mp.id, mp.pet_id, mp.photo_url, mp.last_seen_lat, mp.last_seen_lng, mp.last_seen_city, mp.last_seen_at,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(mp.last_seen_lat, mp.last_seen_lng))/1000)::numeric
  FROM public.missing_pets mp
  WHERE mp.status = 'active' AND mp.last_seen_lat IS NOT NULL AND mp.last_seen_lng IS NOT NULL
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(mp.last_seen_lat, mp.last_seen_lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(mp.last_seen_lat, mp.last_seen_lng)) <= _radius_km*1000
  ORDER BY 8 ASC LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.nearby_meetups(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 50)
RETURNS TABLE (id uuid, title text, lat numeric, lng numeric, city text, starts_at timestamptz, attending_count int, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.title, m.lat, m.lng, m.city, m.starts_at, m.attending_count,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(m.lat, m.lng))/1000)::numeric
  FROM public.meetups m
  WHERE m.status = 'upcoming' AND m.lat IS NOT NULL AND m.lng IS NOT NULL
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(m.lat, m.lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(m.lat, m.lng)) <= _radius_km*1000
  ORDER BY 8 ASC LIMIT 200;
$$;