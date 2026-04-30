-- Add missing FK from service_bookings.provider_id -> service_providers.id
-- so PostgREST can embed provider details in queries and the reminder
-- edge function stops failing with PGRST200.

-- Clean up any orphan rows first to avoid the constraint failing.
DELETE FROM public.service_bookings sb
WHERE sb.provider_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.service_providers sp WHERE sp.id = sb.provider_id
  );

ALTER TABLE public.service_bookings
  ADD CONSTRAINT service_bookings_provider_id_fkey
  FOREIGN KEY (provider_id)
  REFERENCES public.service_providers(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_service_bookings_provider_id
  ON public.service_bookings(provider_id);

NOTIFY pgrst, 'reload schema';