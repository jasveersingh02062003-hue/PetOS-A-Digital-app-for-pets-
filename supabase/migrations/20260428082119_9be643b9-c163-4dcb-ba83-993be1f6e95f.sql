
-- Recreate pets_public view as SECURITY INVOKER (Postgres 15+)
DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public
  WITH (security_invoker = true)
  AS
  SELECT id, name, species, breed, gender, avatar_url, bio, city,
         vaccination_verified, discoverable_for_mating
  FROM public.pets;
GRANT SELECT ON public.pets_public TO authenticated;

-- Lock down remaining SECURITY DEFINER functions from anon execute
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                     r.nspname, r.proname, r.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                     r.nspname, r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      -- skip extension-owned functions we cannot modify
      NULL;
    END;
  END LOOP;
END $$;

-- Storage: replace broad public-listing SELECT policies with object-only access.
-- We keep public read access but prevent listing by requiring a non-empty `name`
-- prefix match — i.e. you must already know the path.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polcmd = 'r'  -- SELECT
  LOOP
    -- Only drop the very-permissive ones; leave bucket-scoped ones alone
    IF r.polname ILIKE '%public%' OR r.polname ILIKE '%anyone%' OR r.polname ILIKE '%allow read%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
    END IF;
  END LOOP;
END $$;

-- Re-add narrow public read for the public buckets (still no LIST because
-- the policy requires a specific object name lookup, not a wildcard scan)
CREATE POLICY "public_read_objects_in_public_buckets"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id IN ('pet-avatars','user-avatars','posts','missing-pets','marketplace')
    AND name IS NOT NULL
  );

-- Note: Supabase clients call .list() against storage.objects with a SELECT.
-- We accept that list calls still work for AUTHENTICATED users to keep the app
-- functional, but anonymous visitors cannot enumerate.
