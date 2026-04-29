-- Auto-revoke vault grants once the appointment ends.
CREATE OR REPLACE FUNCTION public.expire_grants_on_appt_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('completed','cancelled')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.pet_id IS NOT NULL THEN
    UPDATE public.vet_access_grants
       SET revoked = true,
           expires_at = LEAST(expires_at, now())
     WHERE pet_id = NEW.pet_id
       AND created_by = NEW.owner_id
       AND revoked = false
       AND expires_at > now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expire_grants_on_appt_complete ON public.appointments;
CREATE TRIGGER trg_expire_grants_on_appt_complete
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.expire_grants_on_appt_complete();