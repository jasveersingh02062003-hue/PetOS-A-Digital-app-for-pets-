-- Backfill: any neutered pet currently marked discoverable should be turned off
UPDATE public.pets SET discoverable_for_mating = false WHERE neutered = true;

-- Trigger function: force discoverable_for_mating = false whenever neutered = true
CREATE OR REPLACE FUNCTION public.enforce_neutered_not_discoverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.neutered, false) = true THEN
    NEW.discoverable_for_mating := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_neutered_not_discoverable ON public.pets;
CREATE TRIGGER trg_enforce_neutered_not_discoverable
BEFORE INSERT OR UPDATE ON public.pets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_neutered_not_discoverable();