-- 1. Add 'buyer' to account_type enum
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'buyer';

-- 2. Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS looking_for jsonb;

-- Unique case-insensitive handle
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_lower_unique
  ON public.profiles ((lower(handle))) WHERE handle IS NOT NULL;

-- 3. Pet status chip
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS status_chip text
  CHECK (status_chip IS NULL OR status_chip IN ('available_for_stud','for_sale','chilling'));

-- 4. Auto-tag bred_on_petos when both parents reference real pets
CREATE OR REPLACE FUNCTION public.tg_auto_bred_on_petos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sire_pet_id IS NOT NULL
     AND NEW.dam_pet_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.pets WHERE id = NEW.sire_pet_id)
     AND EXISTS (SELECT 1 FROM public.pets WHERE id = NEW.dam_pet_id)
  THEN
    -- propagate to the listing too if one exists
    UPDATE public.pet_listings
       SET bred_on_petos = true
     WHERE pet_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_pets_auto_bred ON public.pets;
CREATE TRIGGER tg_pets_auto_bred
AFTER INSERT OR UPDATE OF sire_pet_id, dam_pet_id ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_bred_on_petos();

-- Same auto-flag when a listing is created for a pet that already has both parents
CREATE OR REPLACE FUNCTION public.tg_listing_auto_bred()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_both boolean;
BEGIN
  SELECT (sire_pet_id IS NOT NULL AND dam_pet_id IS NOT NULL)
    INTO has_both
    FROM public.pets WHERE id = NEW.pet_id;
  IF has_both THEN
    NEW.bred_on_petos := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_pet_listings_auto_bred ON public.pet_listings;
CREATE TRIGGER tg_pet_listings_auto_bred
BEFORE INSERT ON public.pet_listings
FOR EACH ROW EXECUTE FUNCTION public.tg_listing_auto_bred();

-- 5. Repeat sellers view (pet_parent accounts with 3+ active listings)
CREATE OR REPLACE VIEW public.repeat_sellers AS
SELECT l.owner_id, COUNT(*)::int AS active_listings
FROM public.pet_listings l
JOIN public.profiles p ON p.id = l.owner_id
WHERE l.active = true
  AND l.status = 'active'
  AND p.account_type = 'pet_parent'
GROUP BY l.owner_id
HAVING COUNT(*) >= 3;

GRANT SELECT ON public.repeat_sellers TO authenticated;