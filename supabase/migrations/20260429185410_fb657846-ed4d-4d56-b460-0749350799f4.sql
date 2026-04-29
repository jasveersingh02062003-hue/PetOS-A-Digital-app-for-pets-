CREATE OR REPLACE FUNCTION public.search_entities(
  p_query text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km integer DEFAULT 50,
  p_entity_type text DEFAULT 'all',
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  entity_type text,
  id uuid,
  title text,
  subtitle text,
  image_url text,
  city text,
  distance_km double precision,
  score double precision,
  payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := COALESCE(NULLIF(trim(p_query), ''), '');
  has_geo boolean := p_lat IS NOT NULL AND p_lng IS NOT NULL;
  radius_m double precision := GREATEST(p_radius_km, 1) * 1000.0;
BEGIN
  RETURN QUERY
  WITH people AS (
    SELECT
      'people'::text AS entity_type,
      p.id,
      COALESCE(p.full_name, 'Unnamed') AS title,
      COALESCE(p.account_type::text, 'pet_parent') AS subtitle,
      p.avatar_url AS image_url,
      p.city,
      CASE WHEN has_geo AND p.lat IS NOT NULL AND p.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(p.lat::float8, p.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(p.full_name,''), q),
        similarity(COALESCE(p.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - p.updated_at)) / 86400.0 AS age_days,
      jsonb_build_object('account_type', p.account_type, 'handle', p.handle) AS payload
    FROM profiles p
    WHERE p.onboarded = true
      AND (p_entity_type IN ('all','people'))
      AND (q = '' OR (COALESCE(p.full_name,'') % q OR COALESCE(p.city,'') % q OR COALESCE(p.full_name,'') ILIKE '%'||q||'%'))
      AND (NOT has_geo OR p.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(p.lat::float8, p.lng::float8))
  ),
  pets AS (
    SELECT
      'pets'::text AS entity_type,
      pl.id,
      COALESCE(NULLIF(pl.title,''), pl.breed, pl.species, 'Listing') AS title,
      CONCAT_WS(' · ', pl.breed, pl.city) AS subtitle,
      (pl.photos)[1] AS image_url,
      pl.city,
      CASE WHEN has_geo AND pl.lat IS NOT NULL AND pl.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(pl.lat::float8, pl.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(pl.title,''), q),
        similarity(COALESCE(pl.breed,''), q),
        similarity(COALESCE(pl.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - pl.created_at)) / 86400.0 AS age_days,
      jsonb_build_object('listing_type', pl.listing_type, 'fee_inr', pl.fee_inr, 'breed', pl.breed) AS payload
    FROM pet_listings pl
    WHERE pl.active = true
      AND pl.status = 'active'::pet_listing_status
      AND (p_entity_type IN ('all','pets'))
      AND (q = '' OR (
        COALESCE(pl.title,'') % q OR COALESCE(pl.breed,'') % q OR COALESCE(pl.city,'') % q
        OR COALESCE(pl.title,'') ILIKE '%'||q||'%' OR COALESCE(pl.breed,'') ILIKE '%'||q||'%'
      ))
      AND (NOT has_geo OR pl.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(pl.lat::float8, pl.lng::float8))
  ),
  providers AS (
    SELECT
      'providers'::text AS entity_type,
      sp.id,
      COALESCE(sp.name, 'Provider') AS title,
      CONCAT_WS(' · ', sp.category::text, sp.city) AS subtitle,
      sp.cover_url AS image_url,
      sp.city,
      CASE WHEN has_geo AND sp.lat IS NOT NULL AND sp.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(sp.lat::float8, sp.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(sp.name,''), q),
        similarity(COALESCE(sp.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - sp.updated_at)) / 86400.0 AS age_days,
      jsonb_build_object('category', sp.category, 'verified', sp.verified) AS payload
    FROM service_providers sp
    WHERE sp.active = true
      AND (p_entity_type IN ('all','providers'))
      AND (q = '' OR (COALESCE(sp.name,'') % q OR COALESCE(sp.city,'') % q OR COALESCE(sp.name,'') ILIKE '%'||q||'%'))
      AND (NOT has_geo OR sp.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(sp.lat::float8, sp.lng::float8))
  ),
  unioned AS (
    SELECT * FROM people
    UNION ALL SELECT * FROM pets
    UNION ALL SELECT * FROM providers
  )
  SELECT
    u.entity_type,
    u.id,
    u.title,
    u.subtitle,
    u.image_url,
    u.city,
    u.distance_km,
    (
      COALESCE(u.sim_score, 0) * 0.5
      + GREATEST(0, 1.0 - LEAST(COALESCE(u.age_days, 365) / 90.0, 1.0)) * 0.3
      + CASE
          WHEN u.distance_km IS NULL THEN 0
          ELSE GREATEST(0, 1.0 - LEAST(u.distance_km / GREATEST(p_radius_km, 1), 1.0)) * 0.2
        END
    )::double precision AS score,
    u.payload
  FROM unioned u
  WHERE (q = '' OR u.sim_score > 0.05)
  ORDER BY score DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;