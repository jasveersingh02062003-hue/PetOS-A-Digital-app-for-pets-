
-- Phase 1: Backend Security Hardening

-- 1. Lock down user_roles: drop the public SELECT policy, add owner-self + admin-only
DROP POLICY IF EXISTS "roles_select_all" ON public.user_roles;

CREATE POLICY "roles_select_own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "roles_select_admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Recreate public-facing views with security_invoker=on so they respect caller RLS
ALTER VIEW public.pets_public SET (security_invoker = on);
ALTER VIEW public.profiles_public SET (security_invoker = on);
ALTER VIEW public.pet_health_status SET (security_invoker = on);
ALTER VIEW public.repeat_sellers SET (security_invoker = on);
ALTER VIEW public.trending_hashtags SET (security_invoker = on);
ALTER VIEW public.subject_ratings SET (security_invoker = on);

-- 3. Make org-docs bucket private (it can hold KYC / verification docs)
UPDATE storage.buckets SET public = false WHERE id = 'org-docs';
