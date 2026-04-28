CREATE TYPE public.adoption_application_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

CREATE TABLE public.adoption_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL,
  shelter_id UUID NOT NULL, -- the listing owner OR shelter user_id for volunteer interest
  listing_id UUID, -- nullable for volunteer interest
  is_volunteer_interest BOOLEAN NOT NULL DEFAULT false,
  home_description TEXT,
  prior_experience TEXT,
  family_size INTEGER,
  has_yard BOOLEAN,
  other_pets TEXT,
  phone TEXT,
  city TEXT,
  status public.adoption_application_status NOT NULL DEFAULT 'pending',
  shelter_note TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adopt_app_insert_self"
ON public.adoption_applications FOR INSERT TO authenticated
WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "adopt_app_select_party"
ON public.adoption_applications FOR SELECT TO authenticated
USING (applicant_id = auth.uid() OR shelter_id = auth.uid());

CREATE POLICY "adopt_app_update_party"
ON public.adoption_applications FOR UPDATE TO authenticated
USING (applicant_id = auth.uid() OR shelter_id = auth.uid())
WITH CHECK (applicant_id = auth.uid() OR shelter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_adoption_apps_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_adoption_apps_updated_at
BEFORE UPDATE ON public.adoption_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_adoption_apps_touch();

CREATE INDEX idx_adopt_apps_listing ON public.adoption_applications(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX idx_adopt_apps_shelter ON public.adoption_applications(shelter_id);
CREATE INDEX idx_adopt_apps_applicant ON public.adoption_applications(applicant_id);