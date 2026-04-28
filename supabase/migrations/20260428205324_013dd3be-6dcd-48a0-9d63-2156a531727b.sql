ALTER TABLE public.mating_listings
  ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mating_listings_paid_until
  ON public.mating_listings(paid_until) WHERE active = true;

-- Daily expiry sweep
CREATE OR REPLACE FUNCTION public.expire_mating_listings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mating_listings
     SET active = false
   WHERE active = true
     AND paid_until IS NOT NULL
     AND paid_until < now();
END;
$$;

REVOKE ALL ON FUNCTION public.expire_mating_listings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_mating_listings() TO service_role;

SELECT cron.schedule(
  'expire-mating-listings-daily',
  '15 2 * * *',
  $$ SELECT public.expire_mating_listings(); $$
);