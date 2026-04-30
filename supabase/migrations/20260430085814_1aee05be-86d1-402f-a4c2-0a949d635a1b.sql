-- 1) Polymorphic wishlists
ALTER TABLE public.wishlists
  DROP CONSTRAINT IF EXISTS wishlists_listing_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='wishlists' AND column_name='kind'
  ) THEN
    ALTER TABLE public.wishlists
      ADD COLUMN kind text NOT NULL DEFAULT 'pet'
      CHECK (kind IN ('pet','product','vet','service'));
  END IF;
END $$;

ALTER TABLE public.wishlists
  DROP CONSTRAINT IF EXISTS wishlists_user_id_listing_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user_kind_listing_uidx
  ON public.wishlists(user_id, kind, listing_id);

-- 2) refund_requests
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('order','booking','taxi','appointment')),
  source_id uuid NOT NULL,
  amount_inr integer,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied','processed')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_refund_requests_user
  ON public.refund_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status
  ON public.refund_requests(status, created_at DESC);

DROP POLICY IF EXISTS "refund_select_own_or_staff" ON public.refund_requests;
CREATE POLICY "refund_select_own_or_staff" ON public.refund_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "refund_insert_own" ON public.refund_requests;
CREATE POLICY "refund_insert_own" ON public.refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "refund_update_staff" ON public.refund_requests;
CREATE POLICY "refund_update_staff" ON public.refund_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'finance')
  );

DROP TRIGGER IF EXISTS trg_refund_requests_updated ON public.refund_requests;
CREATE TRIGGER trg_refund_requests_updated
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';