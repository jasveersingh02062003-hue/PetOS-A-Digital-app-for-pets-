-- =====================================================================
-- Phase 5: Close the security backlog
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) REVOKE EXECUTE on SECURITY DEFINER functions from anon/public.
--    Keep only the small whitelist of functions that legitimately
--    power public (signed-out) pages: public pet profile, public
--    profile lookup, public sitemap, public search.
--    Trigger helpers do NOT need any EXECUTE grants — triggers run
--    as the function owner regardless of caller privileges.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  whitelist text[] := ARRAY[
    'get_pet_public_by_ref',
    'get_pets_public',
    'get_profile_public_by_ref',
    'get_profiles_public',
    'get_public_walk',
    'search_entities',
    'nearby_meetups',
    'nearby_missing',
    'nearby_providers',
    'nearby_vets',
    'provider_social_proof',
    'find_users_within_radius_km',
    'review_summary',
    'review_summaries_bulk',
    'has_role',          -- read-only role check, used in policies
    'is_blocked',        -- read-only, used in policies
    'is_staff',          -- read-only
    'is_conversation_member',
    'is_transport_driver',
    'has_active_subscription',
    'current_tier',
    'check_pet_eligible_for_mating',
    'check_pet_boarding_eligible',
    'admin_kpis',        -- the function itself enforces is_staff()
    'vet_can_read_pet'
  ];
  fn record;
  fn_signature text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT (p.proname = ANY(whitelist))
  LOOP
    fn_signature := format('public.%I(%s)', fn.proname, fn.args);
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn_signature);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn_signature);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not revoke on %: %', fn_signature, SQLERRM;
    END;
  END LOOP;

  -- Make sure authenticated still has EXECUTE on the helpers it needs
  -- (most were granted to public/anon historically; explicit grant is safer).
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    fn_signature := format('public.%I(%s)', fn.proname, fn.args);
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_signature);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not grant authenticated on %: %', fn_signature, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2) Storage: stop allowing anonymous LIST of files in public buckets.
--    Public buckets remain publicly READABLE by direct URL (which is
--    how avatars/posts/stories load for everyone). What we close is
--    the ability to ask `storage.objects` for the full list.
-- ---------------------------------------------------------------------

-- Drop the broad cross-bucket policy.
DROP POLICY IF EXISTS "public_read_objects_in_public_buckets" ON storage.objects;

-- Re-create per-bucket SELECT policies that restrict listing to
-- authenticated users while still allowing the storage CDN to serve
-- individual file URLs (the CDN uses a service-role path that
-- bypasses RLS entirely, so direct URL fetches keep working).

DO $$
DECLARE
  b text;
  public_buckets text[] := ARRAY[
    'marketplace', 'missing-pets', 'pet-avatars',
    'pet-listings', 'posts', 'stories', 'user-avatars'
  ];
BEGIN
  FOREACH b IN ARRAY public_buckets LOOP
    EXECUTE format($pol$
      DROP POLICY IF EXISTS "auth_can_list_%1$s" ON storage.objects;
      CREATE POLICY "auth_can_list_%1$s" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = %2$L);
    $pol$, b, b);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3) Document acceptance of remaining warnings.
--    pg_trgm / postgis / pgcrypto / vector live in `public` because
--    moving them would break dozens of downstream functions and views.
--    This is a knowingly accepted risk — the extensions themselves
--    do not expose data; their object schema is just cosmetic.
-- ---------------------------------------------------------------------

COMMENT ON SCHEMA public IS
  'App schema. Extensions pg_trgm/postgis/pgcrypto/vector are intentionally kept here; moving them would require rewriting dependent functions. Reviewed Phase 5.';
