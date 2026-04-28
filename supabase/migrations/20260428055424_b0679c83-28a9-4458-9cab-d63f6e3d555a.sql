-- Enums
CREATE TYPE public.service_category AS ENUM ('grooming','training','walking','sitting','boarding','vet_clinic');
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','declined','completed','cancelled');
CREATE TYPE public.product_category AS ENUM ('food','toys','accessories','health','grooming','other');
CREATE TYPE public.order_status AS ENUM ('pending','paid','shipped','delivered','cancelled');

-- Service providers
CREATE TABLE public.service_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  category service_category NOT NULL,
  city text,
  bio text,
  hourly_rate_inr integer,
  cover_url text,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY providers_select_all ON public.service_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY providers_owner_insert ON public.service_providers FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY providers_owner_update ON public.service_providers FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY providers_owner_delete ON public.service_providers FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_providers_updated BEFORE UPDATE ON public.service_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Service bookings
CREATE TABLE public.service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  pet_id uuid,
  scheduled_at timestamptz NOT NULL,
  notes text,
  status booking_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_party_select ON public.service_bookings FOR SELECT TO authenticated
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = service_bookings.provider_id AND p.owner_id = auth.uid()));
CREATE POLICY bookings_customer_insert ON public.service_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY bookings_party_update ON public.service_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = service_bookings.provider_id AND p.owner_id = auth.uid()))
  WITH CHECK (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = service_bookings.provider_id AND p.owner_id = auth.uid()));
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.service_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shop products
CREATE TABLE public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category product_category NOT NULL DEFAULT 'other',
  price_inr integer NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select_all ON public.shop_products FOR SELECT TO authenticated USING (true);
CREATE POLICY products_seller_insert ON public.shop_products FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY products_seller_update ON public.shop_products FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY products_seller_delete ON public.shop_products FOR DELETE TO authenticated USING (auth.uid() = seller_id);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.shop_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shop orders
CREATE TABLE public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  total_inr integer NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  shipping_address text,
  contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_customer_select ON public.shop_orders FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY orders_customer_insert ON public.shop_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE POLICY orders_customer_update ON public.shop_orders FOR UPDATE TO authenticated USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Shop order items
CREATE TABLE public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_inr integer NOT NULL,
  title_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_party_select ON public.shop_order_items FOR SELECT TO authenticated
  USING (auth.uid() = seller_id OR EXISTS (SELECT 1 FROM public.shop_orders o WHERE o.id = shop_order_items.order_id AND o.customer_id = auth.uid()));
CREATE POLICY items_customer_insert ON public.shop_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shop_orders o WHERE o.id = shop_order_items.order_id AND o.customer_id = auth.uid()));

CREATE INDEX idx_providers_category ON public.service_providers(category) WHERE active;
CREATE INDEX idx_products_category ON public.shop_products(category) WHERE active;
CREATE INDEX idx_bookings_provider ON public.service_bookings(provider_id);
CREATE INDEX idx_orders_customer ON public.shop_orders(customer_id);
CREATE INDEX idx_items_order ON public.shop_order_items(order_id);