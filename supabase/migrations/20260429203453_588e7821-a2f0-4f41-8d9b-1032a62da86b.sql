
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS donor_pan TEXT,
  ADD COLUMN IF NOT EXISTS tax_receipt_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS receipt_issued_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.assign_tax_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_type TEXT;
BEGIN
  IF NEW.status = 'paid' AND NEW.tax_receipt_number IS NULL THEN
    SELECT account_type INTO org_type FROM public.profiles WHERE id = NEW.org_user_id;
    IF org_type IN ('sanctuary', 'zoo', 'shelter') THEN
      NEW.tax_receipt_number := 'PETOS-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 99999999)::int)::text, 8, '0');
      NEW.receipt_issued_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donations_assign_receipt ON public.donations;
CREATE TRIGGER donations_assign_receipt
BEFORE INSERT OR UPDATE OF status ON public.donations
FOR EACH ROW
EXECUTE FUNCTION public.assign_tax_receipt_number();

-- Backfill existing paid donations
UPDATE public.donations d
SET tax_receipt_number = 'PETOS-' || to_char(coalesce(d.paid_at, d.created_at), 'YYYY') || '-' || lpad((floor(random() * 99999999)::int)::text, 8, '0'),
    receipt_issued_at = coalesce(d.paid_at, d.created_at)
WHERE d.status = 'paid'
  AND d.tax_receipt_number IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = d.org_user_id AND p.account_type IN ('sanctuary', 'zoo', 'shelter')
  );
