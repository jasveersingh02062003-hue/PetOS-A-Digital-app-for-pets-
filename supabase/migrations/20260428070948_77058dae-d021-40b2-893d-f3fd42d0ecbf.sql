REVOKE EXECUTE ON FUNCTION public.get_profiles_public() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_pets_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated;