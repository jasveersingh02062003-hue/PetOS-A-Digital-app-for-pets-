-- M3: Shop ETA + Order shipment tracking + realtime

-- 1) Extend shop_orders with shipment fields
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS eta_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 2) Auto-stamp shipped_at / delivered_at on status change
CREATE OR REPLACE FUNCTION public.stamp_order_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'shipped' AND (OLD.status IS DISTINCT FROM 'shipped') AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at := now();
    IF NEW.eta_at IS NULL THEN
      NEW.eta_at := now() + interval '3 days';
    END IF;
  END IF;
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_order_shipment ON public.shop_orders;
CREATE TRIGGER trg_stamp_order_shipment
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_order_shipment();

-- 3) Realtime on shop_orders
ALTER TABLE public.shop_orders REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shop_orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_orders';
  END IF;
END $$;

-- 4) Lightweight pincode-distance ETA estimator
-- Heuristic: same 3-digit prefix => 1-2 days, same 2-digit => 3-4 days, else 5-7 days.
CREATE OR REPLACE FUNCTION public.estimate_delivery_days(p_from text, p_to text)
RETURNS TABLE(min_days int, max_days int, zone text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  f text;
  t text;
BEGIN
  f := regexp_replace(coalesce(p_from,''), '\D', '', 'g');
  t := regexp_replace(coalesce(p_to,''), '\D', '', 'g');
  IF length(f) < 6 OR length(t) < 6 THEN
    RETURN QUERY SELECT 4, 7, 'national'::text; RETURN;
  END IF;
  IF substr(f,1,3) = substr(t,1,3) THEN
    RETURN QUERY SELECT 1, 2, 'local'::text; RETURN;
  ELSIF substr(f,1,2) = substr(t,1,2) THEN
    RETURN QUERY SELECT 2, 4, 'regional'::text; RETURN;
  ELSIF substr(f,1,1) = substr(t,1,1) THEN
    RETURN QUERY SELECT 3, 5, 'zonal'::text; RETURN;
  ELSE
    RETURN QUERY SELECT 4, 7, 'national'::text; RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.estimate_delivery_days(text, text) TO anon, authenticated;