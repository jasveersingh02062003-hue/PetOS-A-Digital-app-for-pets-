
GRANT SELECT (donor_pan) ON public.donations TO authenticated;
GRANT SELECT (phone) ON public.org_profiles TO authenticated;
GRANT SELECT (contact_phone) ON public.service_providers TO authenticated;

-- Keep the helper RPCs in place — they are still useful for future migration to view-based reads.
-- (no DROP)
