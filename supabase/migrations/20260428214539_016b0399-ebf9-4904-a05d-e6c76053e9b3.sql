
REVOKE EXECUTE ON FUNCTION public.expire_paid_mating_listings() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_paid_mating_listings() TO service_role;
