
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT id FROM auth.users
  WHERE lower(email) = lower(_email)
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
