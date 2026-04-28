CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');

-- Vet applications
CREATE TABLE public.vet_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  clinic_name text NOT NULL,
  license_number text NOT NULL,
  city text,
  bio text,
  status application_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vet_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY vet_apps_self_select ON public.vet_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY vet_apps_self_insert ON public.vet_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY vet_apps_admin_update ON public.vet_applications FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_vet_apps_updated BEFORE UPDATE ON public.vet_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verification requests
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending',
  notes text,
  reviewer_id uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ver_reqs_owner_select ON public.verification_requests FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR has_role(auth.uid(),'vet') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY ver_reqs_owner_insert ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY ver_reqs_reviewer_update ON public.verification_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'vet') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'vet') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_ver_reqs_updated BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When a verification is approved, mark the pet
CREATE OR REPLACE FUNCTION public.apply_verification_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.pets SET vaccination_verified = true WHERE id = NEW.pet_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_verification_approval
BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_verification_approval();

-- When a vet application is approved, grant the vet role
CREATE OR REPLACE FUNCTION public.apply_vet_application_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'vet')
    ON CONFLICT DO NOTHING;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_vet_app_approval
BEFORE UPDATE ON public.vet_applications
FOR EACH ROW EXECUTE FUNCTION public.apply_vet_application_approval();

CREATE INDEX idx_ver_reqs_status ON public.verification_requests(status);
CREATE INDEX idx_vet_apps_status ON public.vet_applications(status);