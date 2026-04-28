-- Extend mating_listings with boost/featured flags
ALTER TABLE public.mating_listings
  ADD COLUMN IF NOT EXISTS boosted_until timestamptz,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- Extend mating_agreements with structured deal terms
ALTER TABLE public.mating_agreements
  ADD COLUMN IF NOT EXISTS deal_type text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stud_fee_inr integer,
  ADD COLUMN IF NOT EXISTS puppy_split_owner_pct integer,
  ADD COLUMN IF NOT EXISTS puppy_split_partner_pct integer,
  ADD COLUMN IF NOT EXISTS meeting_date date,
  ADD COLUMN IF NOT EXISTS meeting_location text,
  ADD COLUMN IF NOT EXISTS extra_terms text,
  ADD COLUMN IF NOT EXISTS terms_locked boolean NOT NULL DEFAULT false;

-- Validation trigger: deal_type whitelist + lock terms once both sign
CREATE OR REPLACE FUNCTION public.tg_validate_mating_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deal_type NOT IN ('free','stud_fee','puppy_split','other') THEN
    RAISE EXCEPTION 'Invalid deal_type: %', NEW.deal_type;
  END IF;

  IF NEW.deal_type = 'puppy_split' THEN
    IF NEW.puppy_split_owner_pct IS NULL OR NEW.puppy_split_partner_pct IS NULL THEN
      RAISE EXCEPTION 'Puppy split requires both percentages';
    END IF;
    IF (NEW.puppy_split_owner_pct + NEW.puppy_split_partner_pct) <> 100 THEN
      RAISE EXCEPTION 'Puppy split percentages must sum to 100';
    END IF;
  END IF;

  IF NEW.deal_type = 'stud_fee' AND (NEW.stud_fee_inr IS NULL OR NEW.stud_fee_inr <= 0) THEN
    RAISE EXCEPTION 'Stud fee deal requires a positive stud_fee_inr';
  END IF;

  -- Auto-lock once both signatures present
  IF NEW.from_signature IS NOT NULL AND NEW.to_signature IS NOT NULL THEN
    NEW.terms_locked := true;
  END IF;

  -- Block edits to deal terms once locked, except signature/timestamp updates
  IF TG_OP = 'UPDATE' AND OLD.terms_locked = true THEN
    IF NEW.deal_type IS DISTINCT FROM OLD.deal_type
       OR NEW.stud_fee_inr IS DISTINCT FROM OLD.stud_fee_inr
       OR NEW.puppy_split_owner_pct IS DISTINCT FROM OLD.puppy_split_owner_pct
       OR NEW.puppy_split_partner_pct IS DISTINCT FROM OLD.puppy_split_partner_pct
       OR NEW.meeting_date IS DISTINCT FROM OLD.meeting_date
       OR NEW.meeting_location IS DISTINCT FROM OLD.meeting_location
       OR NEW.extra_terms IS DISTINCT FROM OLD.extra_terms
       OR NEW.terms_text IS DISTINCT FROM OLD.terms_text THEN
      RAISE EXCEPTION 'Agreement terms are locked once both parties sign';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_mating_agreement ON public.mating_agreements;
CREATE TRIGGER validate_mating_agreement
  BEFORE INSERT OR UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_mating_agreement();

-- Mating payments ledger (offline tracking)
CREATE TABLE IF NOT EXISTS public.mating_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mating_requests(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount_inr integer NOT NULL CHECK (amount_inr >= 0),
  method text NOT NULL DEFAULT 'cash',
  reference text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  marked_paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mating_payments_request_idx ON public.mating_payments(request_id);
CREATE INDEX IF NOT EXISTS mating_payments_payer_idx ON public.mating_payments(payer_id);
CREATE INDEX IF NOT EXISTS mating_payments_payee_idx ON public.mating_payments(payee_id);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.tg_validate_mating_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind NOT IN ('listing_boost','stud_fee','pick_of_litter','deposit','other') THEN
    RAISE EXCEPTION 'Invalid kind: %', NEW.kind;
  END IF;
  IF NEW.method NOT IN ('cash','upi','bank','other') THEN
    RAISE EXCEPTION 'Invalid method: %', NEW.method;
  END IF;
  IF NEW.status NOT IN ('pending','marked_paid','confirmed','disputed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.payer_id = NEW.payee_id THEN
    RAISE EXCEPTION 'payer and payee must differ';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_mating_payment ON public.mating_payments;
CREATE TRIGGER validate_mating_payment
  BEFORE INSERT OR UPDATE ON public.mating_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_mating_payment();

-- Notify other party on payment events
CREATE OR REPLACE FUNCTION public.tg_notify_mating_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.payee_id, 'mate_payment',
      'Payment recorded',
      '₹' || NEW.amount_inr || ' (' || NEW.kind || ') — awaiting your confirmation',
      '/mates/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.payer_id, 'mate_payment_status',
      'Payment ' || NEW.status,
      'Status updated for ₹' || NEW.amount_inr,
      '/mates/manage');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_mating_payment ON public.mating_payments;
CREATE TRIGGER notify_mating_payment
  AFTER INSERT OR UPDATE ON public.mating_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_mating_payment();

-- RLS
ALTER TABLE public.mating_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: parties can read"
  ON public.mating_payments FOR SELECT TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);

CREATE POLICY "payments: payer can insert"
  ON public.mating_payments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = payer_id
    AND EXISTS (
      SELECT 1 FROM public.mating_requests r
      WHERE r.id = request_id
        AND (r.from_owner_id = auth.uid() OR r.to_owner_id = auth.uid())
        AND (r.from_owner_id = payee_id OR r.to_owner_id = payee_id)
    )
  );

CREATE POLICY "payments: parties can update"
  ON public.mating_payments FOR UPDATE TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);

CREATE POLICY "payments: parties can delete pending"
  ON public.mating_payments FOR DELETE TO authenticated
  USING ((auth.uid() = payer_id OR auth.uid() = payee_id) AND status IN ('pending','cancelled'));