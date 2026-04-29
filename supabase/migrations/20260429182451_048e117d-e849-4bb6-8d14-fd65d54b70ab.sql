-- Audit log of shelter decisions on adoption applications
CREATE TABLE public.adoption_application_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.adoption_applications(id) ON DELETE CASCADE,
  decided_by UUID NOT NULL,
  status public.adoption_application_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aad_application ON public.adoption_application_decisions(application_id, created_at DESC);
CREATE INDEX idx_aad_decided_by ON public.adoption_application_decisions(decided_by);

ALTER TABLE public.adoption_application_decisions ENABLE ROW LEVEL SECURITY;

-- Shelter who owns the application can read its decisions
CREATE POLICY "Shelter views decisions for own apps"
  ON public.adoption_application_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.adoption_applications a
    WHERE a.id = application_id AND a.shelter_id = auth.uid()
  ));

-- Applicant can read decisions on their own application
CREATE POLICY "Applicant views decisions on own app"
  ON public.adoption_application_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.adoption_applications a
    WHERE a.id = application_id AND a.applicant_id = auth.uid()
  ));

-- Trigger: when application status changes, record decision + notify applicant
CREATE OR REPLACE FUNCTION public.handle_adoption_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected') THEN

    -- audit row (decided_by = current auth user, falls back to shelter_id)
    INSERT INTO public.adoption_application_decisions(application_id, decided_by, status, note)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.shelter_id), NEW.status, NEW.shelter_note);

    -- notify the applicant
    IF NEW.status = 'approved' THEN
      v_title := 'Your application was approved';
      v_body  := COALESCE(NEW.shelter_note, 'The shelter has approved your application. They will reach out shortly.');
    ELSE
      v_title := 'Your application was declined';
      v_body  := COALESCE(NEW.shelter_note, 'Thank you for applying. The shelter has declined this application.');
    END IF;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.applicant_id,
      'adoption_decision',
      v_title,
      v_body,
      '/adopt'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adoption_decision ON public.adoption_applications;
CREATE TRIGGER trg_adoption_decision
  AFTER UPDATE ON public.adoption_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_adoption_decision();