
-- Replace the broad "true" policy with one that scopes to active providers
DROP POLICY IF EXISTS providers_select_all ON public.service_providers;

CREATE POLICY providers_select_active
ON public.service_providers
FOR SELECT
TO authenticated
USING (
  active = true
);

-- Owner and admins still need to see their own / all (including inactive) records
CREATE POLICY providers_select_owner
ON public.service_providers
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);
