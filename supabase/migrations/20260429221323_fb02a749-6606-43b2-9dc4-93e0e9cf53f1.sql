
REVOKE SELECT (donor_pan) ON public.donations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_my_donation_pan(_donation_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT donor_pan
  FROM public.donations
  WHERE id = _donation_id
    AND donor_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_donation_pan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_donation_pan(uuid) TO authenticated;

REVOKE SELECT (phone) ON public.org_profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_org_profile_phone(_org_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone
  FROM public.org_profiles
  WHERE user_id = _org_user_id
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_profile_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_profile_phone(uuid) TO authenticated;

REVOKE SELECT (contact_phone) ON public.service_providers FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_service_provider_phone(_provider_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contact_phone
  FROM public.service_providers
  WHERE id = _provider_id
    AND (
      owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.service_bookings sb
        WHERE sb.provider_id = _provider_id
          AND sb.customer_id = auth.uid()
          AND sb.status::text NOT IN ('cancelled','declined')
      )
      OR EXISTS (
        SELECT 1 FROM public.transport_bookings tb
        WHERE tb.provider_id = _provider_id
          AND tb.customer_id = auth.uid()
          AND tb.status::text NOT IN ('cancelled','declined')
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_service_provider_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_provider_phone(uuid) TO authenticated;
