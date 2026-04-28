-- Vaccinations
CREATE TABLE public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  administered_on DATE NOT NULL,
  next_due_on DATE,
  batch_number TEXT,
  vet_name TEXT,
  document_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vaccinations_pet ON public.vaccinations(pet_id);
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access vaccinations" ON public.vaccinations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE TRIGGER trg_vaccinations_updated BEFORE UPDATE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Health records
CREATE TYPE public.health_record_type AS ENUM ('visit','diagnostic','prescription','surgery','allergy','other');

CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  record_type public.health_record_type NOT NULL DEFAULT 'visit',
  title TEXT NOT NULL,
  notes TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  document_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_records_pet ON public.health_records(pet_id);
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access health_records" ON public.health_records
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE TRIGGER trg_health_records_updated BEFORE UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vault documents
CREATE TABLE public.vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vault_documents_pet ON public.vault_documents(pet_id);
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access vault_documents" ON public.vault_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Symptom logs
CREATE TABLE public.symptom_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  symptom TEXT NOT NULL,
  severity SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_symptom_logs_pet ON public.symptom_logs(pet_id);
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access symptom_logs" ON public.symptom_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Nutrition logs
CREATE TABLE public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  food TEXT NOT NULL,
  portion TEXT,
  fed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrition_logs_pet ON public.nutrition_logs(pet_id);
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access nutrition_logs" ON public.nutrition_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Vet access grants (8-char shareable code)
CREATE TABLE public.vet_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  vet_name TEXT,
  clinic_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vet_access_grants_pet ON public.vet_access_grants(pet_id);
CREATE INDEX idx_vet_access_grants_code ON public.vet_access_grants(code);
ALTER TABLE public.vet_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages vet_access_grants" ON public.vet_access_grants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()) AND created_by = auth.uid());