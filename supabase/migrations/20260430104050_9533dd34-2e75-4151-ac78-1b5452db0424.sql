DO $$ BEGIN
  CREATE TYPE public.vax_verification_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vaccination_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  status public.vax_verification_status NOT NULL DEFAULT 'pending',
  reviewer_vet_id uuid,
  reviewer_note text,
  photo_paths text[],
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vvr_pet ON public.vaccination_verification_requests(pet_id, status);
CREATE INDEX IF NOT EXISTS idx_vvr_pending ON public.vaccination_verification_requests(status) WHERE status = 'pending';

ALTER TABLE public.vaccination_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own requests"
ON public.vaccination_verification_requests FOR SELECT
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Owner can submit requests"
ON public.vaccination_verification_requests FOR INSERT
WITH CHECK (
  submitted_by = auth.uid()
  AND public.is_pet_owner(pet_id, auth.uid())
);

CREATE POLICY "Care-team vets and admins can read pending requests"
ON public.vaccination_verification_requests FOR SELECT
USING (
  public.is_pet_care_team_vet(pet_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Care-team vets and admins can review"
ON public.vaccination_verification_requests FOR UPDATE
USING (
  public.is_pet_care_team_vet(pet_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.is_pet_care_team_vet(pet_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER trg_vvr_updated
BEFORE UPDATE ON public.vaccination_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_vax_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.pets SET vaccination_verified = true WHERE id = NEW.pet_id;
    NEW.reviewed_at := now();
    NEW.reviewer_vet_id := COALESCE(NEW.reviewer_vet_id, auth.uid());
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at := now();
    NEW.reviewer_vet_id := COALESCE(NEW.reviewer_vet_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vvr_apply
BEFORE UPDATE ON public.vaccination_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_vax_verification();