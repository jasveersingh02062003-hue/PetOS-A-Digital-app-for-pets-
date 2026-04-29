
-- ---------- EXHIBITS ----------
CREATE TABLE public.exhibits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zoo_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT,
  description TEXT,
  habitat TEXT,
  on_display BOOLEAN NOT NULL DEFAULT true,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exhibits_zoo ON public.exhibits(zoo_user_id);
CREATE INDEX idx_exhibits_on_display ON public.exhibits(zoo_user_id, on_display);

ALTER TABLE public.exhibits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exhibits are viewable by everyone"
  ON public.exhibits FOR SELECT USING (true);
CREATE POLICY "Zoo owners can insert their exhibits"
  ON public.exhibits FOR INSERT WITH CHECK (auth.uid() = zoo_user_id);
CREATE POLICY "Zoo owners can update their exhibits"
  ON public.exhibits FOR UPDATE USING (auth.uid() = zoo_user_id);
CREATE POLICY "Zoo owners can delete their exhibits"
  ON public.exhibits FOR DELETE USING (auth.uid() = zoo_user_id);

CREATE TRIGGER update_exhibits_updated_at
  BEFORE UPDATE ON public.exhibits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- PEDIGREE CERTIFICATES ----------
CREATE TABLE public.pedigree_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  registry_name TEXT,
  sire_name TEXT,
  dam_name TEXT,
  breed TEXT,
  notes TEXT,
  document_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedigree_pet ON public.pedigree_certificates(pet_id);
CREATE INDEX idx_pedigree_issuer ON public.pedigree_certificates(issued_by);

ALTER TABLE public.pedigree_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedigree certificates are viewable by everyone"
  ON public.pedigree_certificates FOR SELECT USING (true);
CREATE POLICY "Issuers can create pedigree certificates for their own pets"
  ON public.pedigree_certificates FOR INSERT
  WITH CHECK (
    auth.uid() = issued_by
    AND EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = pedigree_certificates.pet_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Issuers can update their pedigree certificates"
  ON public.pedigree_certificates FOR UPDATE USING (auth.uid() = issued_by);
CREATE POLICY "Issuers can delete their pedigree certificates"
  ON public.pedigree_certificates FOR DELETE USING (auth.uid() = issued_by);

CREATE TRIGGER update_pedigree_updated_at
  BEFORE UPDATE ON public.pedigree_certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_pedigree_certificate_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.certificate_number IS NULL OR NEW.certificate_number = '' THEN
    NEW.certificate_number := 'PETOS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pedigree_certificate_number
  BEFORE INSERT ON public.pedigree_certificates
  FOR EACH ROW EXECUTE FUNCTION public.handle_pedigree_certificate_number();
