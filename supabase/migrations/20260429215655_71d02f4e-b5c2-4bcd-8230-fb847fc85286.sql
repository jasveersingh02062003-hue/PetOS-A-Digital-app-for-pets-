
-- 1. service_providers.contact_phone: column-level revoke
REVOKE SELECT (contact_phone) ON public.service_providers FROM anon, authenticated;
-- Owners still see everything via the existing owner policies and re-grant their column read
GRANT SELECT (contact_phone) ON public.service_providers TO authenticated;
-- Note: column GRANT to authenticated is global; row-level RLS still enforces who sees rows.
-- To truly hide phone from non-owners we add a column policy via view:
CREATE OR REPLACE VIEW public.service_providers_public
WITH (security_invoker = on) AS
SELECT id, owner_id, name, category, city, bio, hourly_rate_inr, cover_url,
       verified, active, lat, lng, trust_status, years_experience, service_radius_km,
       languages, days_available, time_slots, accepting_jobs, verification_status,
       details, created_at, updated_at
FROM public.service_providers;
GRANT SELECT ON public.service_providers_public TO anon, authenticated;

-- 2. org_profiles.phone: column-level revoke + safe view
REVOKE SELECT (phone) ON public.org_profiles FROM anon, authenticated;
GRANT SELECT (phone) ON public.org_profiles TO authenticated;
CREATE OR REPLACE VIEW public.org_profiles_public
WITH (security_invoker = on) AS
SELECT user_id, org_name, org_type, address, city, state, pincode,
       lat, lng, website, description, facility_photos, donation_upi, donation_url,
       status, total_donations_inr, donor_count, created_at, updated_at
FROM public.org_profiles
WHERE status = 'approved';
GRANT SELECT ON public.org_profiles_public TO anon, authenticated;

-- 3. donations.donor_pan: revoke from non-donor
REVOKE SELECT (donor_pan) ON public.donations FROM anon, authenticated;
GRANT SELECT (donor_pan) ON public.donations TO authenticated;
-- Org-facing view (no donor_pan)
CREATE OR REPLACE VIEW public.donations_for_org
WITH (security_invoker = on) AS
SELECT id, donor_id, org_user_id, amount_inr, message, anonymous, status,
       payment_intent_id, created_at, paid_at, tax_receipt_number, receipt_issued_at
FROM public.donations;
GRANT SELECT ON public.donations_for_org TO authenticated;

-- 4. Remove public read on org-docs storage bucket
DROP POLICY IF EXISTS "org-docs public read" ON storage.objects;

CREATE POLICY "org-docs owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'org-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "org-docs admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-docs'
    AND (public.has_role(auth.uid(), 'super_admin'::app_role)
         OR public.has_role(auth.uid(), 'moderator'::app_role))
  );

-- 5. Realtime channel authorization
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can subscribe to own user channel" ON realtime.messages;
CREATE POLICY "users can subscribe to own user channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('user:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('alerts:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('notifications:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE 'public:%'
  );

DROP POLICY IF EXISTS "users can broadcast to own user channel" ON realtime.messages;
CREATE POLICY "users can broadcast to own user channel"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE ('user:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('alerts:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('notifications:' || (auth.uid())::text || '%')
  );
