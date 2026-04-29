DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_kind' AND e.enumlabel = 'puppy_sale'
  ) THEN
    ALTER TYPE public.payment_kind ADD VALUE 'puppy_sale';
  END IF;
END$$;