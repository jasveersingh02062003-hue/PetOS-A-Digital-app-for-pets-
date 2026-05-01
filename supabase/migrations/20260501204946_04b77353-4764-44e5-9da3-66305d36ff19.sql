-- Fix the snapshot trigger to use real column names from public.pets
CREATE OR REPLACE FUNCTION public.fill_post_pet_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  age_months INT;
BEGIN
  IF NEW.pet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, breed, date_of_birth, avatar_url, owner_id, vaccination_verified, city
    INTO p
    FROM public.pets
   WHERE id = NEW.pet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  age_months := CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    ELSE GREATEST(0, (EXTRACT(YEAR FROM age(p.date_of_birth))::INT * 12)
                   + EXTRACT(MONTH FROM age(p.date_of_birth))::INT)
  END;

  NEW.pet_snapshot := jsonb_build_object(
    'name', p.name,
    'breed', p.breed,
    'age_months', age_months,
    'avatar_url', p.avatar_url,
    'vaccines_ok', COALESCE(p.vaccination_verified, false),
    'city', p.city
  );

  RETURN NEW;
END;
$$;

-- Make sure trigger fires on UPDATE too (for backfill)
DROP TRIGGER IF EXISTS trg_fill_post_pet_snapshot ON public.posts;
CREATE TRIGGER trg_fill_post_pet_snapshot
BEFORE INSERT OR UPDATE OF pet_id ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.fill_post_pet_snapshot();

-- Backfill pet_id from author's first pet where missing
UPDATE public.posts p
SET pet_id = sub.pet_id
FROM (
  SELECT DISTINCT ON (owner_id) owner_id, id AS pet_id
  FROM public.pets
  ORDER BY owner_id, created_at ASC
) sub
WHERE p.author_id = sub.owner_id
  AND p.pet_id IS NULL;

-- Force snapshot recompute by touching pet_id (this fires the trigger)
UPDATE public.posts SET pet_id = pet_id WHERE pet_id IS NOT NULL;