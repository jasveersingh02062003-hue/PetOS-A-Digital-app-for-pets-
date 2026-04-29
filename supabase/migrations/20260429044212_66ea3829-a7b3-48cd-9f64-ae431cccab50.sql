-- Add refund + receipt tracking to payment_intents
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS price_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'inr',
  ADD COLUMN IF NOT EXISTS refunded_amount_inr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS provider_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Auto-issue receipt numbers like PETOS-2026-000123
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION public.tg_assign_receipt_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.receipt_number IS NULL AND NEW.status::text = 'paid' THEN
    NEW.receipt_number := 'PETOS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_intents_receipt ON public.payment_intents;
CREATE TRIGGER trg_payment_intents_receipt
BEFORE INSERT OR UPDATE OF status ON public.payment_intents
FOR EACH ROW
EXECUTE FUNCTION public.tg_assign_receipt_number();

-- Allow customers to view their own receipts publicly via intent id (RLS already covers user_id reads)
-- Index for fast session id lookups from webhook
CREATE INDEX IF NOT EXISTS idx_payment_intents_session ON public.payment_intents(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON public.payment_intents(user_id, created_at DESC);