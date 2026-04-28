
-- Status enum for transfers
DO $$ BEGIN
  CREATE TYPE public.transfer_status AS ENUM ('pending','accepted','declined','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  price_inr integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_to ON public.ownership_transfers(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON public.ownership_transfers(from_user_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_listing ON public.ownership_transfers(listing_id);

ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY transfers_select_party ON public.ownership_transfers
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY transfers_insert_seller ON public.ownership_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM public.pet_listings l
      WHERE l.id = listing_id AND l.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = pet_id AND p.owner_id = auth.uid()
    )
  );

-- Seller cancels, buyer accepts/declines (only when still pending)
CREATE POLICY transfers_update_party ON public.ownership_transfers
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  )
  WITH CHECK (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- Trigger: on accept, transfer pet ownership + close listing + notify
CREATE OR REPLACE FUNCTION public.tg_apply_ownership_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pet_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.decided_at := now();

    IF NEW.status = 'accepted' THEN
      -- Move pet to buyer
      UPDATE public.pets SET owner_id = NEW.to_user_id WHERE id = NEW.pet_id;
      -- Close listing
      UPDATE public.pet_listings
        SET status = 'sold', active = false
        WHERE id = NEW.listing_id;

      SELECT name INTO v_pet_name FROM public.pets WHERE id = NEW.pet_id;
      PERFORM public.notify_user(NEW.from_user_id, 'transfer_accepted',
        'Transfer complete',
        COALESCE(v_pet_name,'Your pet') || ' is now with the new owner',
        '/mates/adopt/' || NEW.listing_id);
      PERFORM public.notify_user(NEW.to_user_id, 'transfer_accepted',
        'Welcome home!',
        COALESCE(v_pet_name,'Your new pet') || ' has been added to your account',
        '/profile');

    ELSIF NEW.status = 'declined' THEN
      PERFORM public.notify_user(NEW.from_user_id, 'transfer_declined',
        'Transfer declined',
        'The buyer declined the ownership transfer',
        '/mates/adopt/' || NEW.listing_id);

    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.notify_user(NEW.to_user_id, 'transfer_cancelled',
        'Transfer cancelled',
        'The seller cancelled the ownership transfer',
        '/mates/adopt/' || NEW.listing_id);
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_apply_ownership_transfer ON public.ownership_transfers;
CREATE TRIGGER tg_apply_ownership_transfer
  BEFORE UPDATE ON public.ownership_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_apply_ownership_transfer();

-- Trigger: notify buyer when transfer is created
CREATE OR REPLACE FUNCTION public.tg_notify_transfer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_pet_name text;
BEGIN
  SELECT name INTO v_pet_name FROM public.pets WHERE id = NEW.pet_id;
  PERFORM public.notify_user(NEW.to_user_id, 'transfer_request',
    'Ownership transfer pending',
    'The seller has initiated transfer of ' || COALESCE(v_pet_name,'a pet') || '. Please confirm.',
    '/mates/adopt/' || NEW.listing_id);
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_notify_transfer_created ON public.ownership_transfers;
CREATE TRIGGER tg_notify_transfer_created
  AFTER INSERT ON public.ownership_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notify_transfer_created();
