
-- =========================================================================
-- 1. REVOKE EXECUTE on trigger-only SECURITY DEFINER functions
--    (triggers run with definer rights regardless of grants)
-- =========================================================================
DO $$
DECLARE
  fn text;
  trigger_only_fns text[] := ARRAY[
    'award_dewormed_badge','award_first_post','award_meetup_host_badge',
    'award_social_butterfly_badge','award_vaccinated_badge',
    'bump_conv_last_message','bump_group_member_count','bump_reaction_counts',
    'bump_comment_count','bump_like_count',
    'on_access_request_decision','on_access_request_insert','on_appointment_event',
    'on_collab_invite','on_collab_response','on_daily_moment_insert',
    'on_new_follow','on_post_reaction','on_rsvp_insert','on_vet_answer',
    'on_booking_event','on_consult_event','on_mating_request',
    'on_order_item_insert','on_order_status','on_post_comment','on_post_like',
    'recount_meetup_attending','sync_post_hashtags','tg_post_to_health',
    'tg_limit_comments','tg_limit_posts','tg_limit_sightings',
    'enforce_missing_free_limit','enforce_neutered_not_discoverable',
    'enqueue_missing_pet_alerts','notify_missing_pet_alerts',
    'notify_owner_on_sighting','set_verified_purchase',
    'maybe_finalize_agreement','handle_new_user',
    'apply_verification_approval','apply_vet_application_approval'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function OR ambiguous_function THEN
      -- function may have multiple sigs or not exist; revoke per-signature
      DECLARE
        sig text;
      BEGIN
        FOR sig IN
          SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
          FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
          WHERE n.nspname='public' AND p.proname=fn
        LOOP
          EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
        END LOOP;
      END;
    END;
  END LOOP;
END $$;

-- =========================================================================
-- 2. REVOKE anon EXECUTE on user-only RPCs (still callable by authenticated)
-- =========================================================================
DO $$
DECLARE
  fn text;
  auth_only_fns text[] := ARRAY[
    'get_or_create_dm','mark_conversation_read','bump_answer_helpful',
    'bump_story_view','send_broadcast','admin_kpis','notify_user',
    'increment_usage','check_pet_eligible_for_mating','check_daily_limit'
  ];
BEGIN
  FOREACH fn IN ARRAY auth_only_fns LOOP
    DECLARE sig text;
    BEGIN
      FOR sig IN
        SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
        WHERE n.nspname='public' AND p.proname=fn
      LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', sig);
      END LOOP;
    END;
  END LOOP;
END $$;

-- =========================================================================
-- 3. Fix overly-permissive notifications insert policy
-- =========================================================================
DROP POLICY IF EXISTS notif_definer_insert ON public.notifications;
CREATE POLICY "notif_service_insert" ON public.notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

-- =========================================================================
-- 4. Add explicit policy to reminder_log (service-role only)
-- =========================================================================
DROP POLICY IF EXISTS "reminder_log_service_all" ON public.reminder_log;
CREATE POLICY "reminder_log_service_all" ON public.reminder_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
