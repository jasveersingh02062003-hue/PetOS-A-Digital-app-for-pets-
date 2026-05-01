-- Phase F: extend the pet_snapshot trigger with 3 additional credibility fields.
-- Backwards-compatible: still writes name/breed/age_months/avatar_url/vaccines_ok/city.
CREATE OR REPLACE FUNCTION public.fill_post_pet_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet RECORD;
  v_age_months INT;
  v_city TEXT;
  v_walk_km NUMERIC;
  v_streak INT;
  v_lineage_ok BOOLEAN;
BEGIN
  IF NEW.pet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, breed, avatar_url, date_of_birth, vaccination_verified, owner_id, litter_id
    INTO v_pet
  FROM public.pets
  WHERE id = NEW.pet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_pet.date_of_birth IS NOT NULL THEN
    v_age_months := GREATEST(0, EXTRACT(YEAR FROM age(v_pet.date_of_birth))::INT * 12
                                + EXTRACT(MONTH FROM age(v_pet.date_of_birth))::INT);
  END IF;

  -- Best-effort city from author profile
  BEGIN
    SELECT lower(NULLIF(city, ''))
      INTO v_city
    FROM public.profiles
    WHERE id = NEW.author_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_city := NULL;
  END;

  -- Lifetime walk km (best effort; table may not exist in all envs)
  BEGIN
    EXECUTE 'SELECT COALESCE(SUM(distance_m),0)/1000.0 FROM public.walk_sessions WHERE pet_id = $1'
      INTO v_walk_km
      USING NEW.pet_id;
  EXCEPTION WHEN OTHERS THEN
    v_walk_km := NULL;
  END;

  -- Care streak (best effort)
  BEGIN
    EXECUTE 'SELECT COALESCE(MAX(streak_days),0) FROM public.pet_care_streaks WHERE pet_id = $1'
      INTO v_streak
      USING NEW.pet_id;
  EXCEPTION WHEN OTHERS THEN
    v_streak := NULL;
  END;

  -- Lineage verified = pet belongs to a registered litter
  v_lineage_ok := v_pet.litter_id IS NOT NULL;

  NEW.pet_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'name',              v_pet.name,
    'breed',             v_pet.breed,
    'age_months',        v_age_months,
    'avatar_url',        v_pet.avatar_url,
    'vaccines_ok',       v_pet.vaccination_verified,
    'city',              v_city,
    'lifetime_walks_km', ROUND(COALESCE(v_walk_km,0)::numeric, 1),
    'streak_days',       v_streak,
    'lineage_verified',  v_lineage_ok
  ));

  RETURN NEW;
END;
$$;

-- Recompute snapshots for existing posts so the new fields appear immediately.
UPDATE public.posts
   SET updated_at = updated_at  -- triggers BEFORE UPDATE → fill_post_pet_snapshot
 WHERE pet_id IS NOT NULL;