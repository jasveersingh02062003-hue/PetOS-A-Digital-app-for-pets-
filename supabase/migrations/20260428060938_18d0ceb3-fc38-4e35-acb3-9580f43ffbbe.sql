CREATE TYPE public.review_subject AS ENUM ('provider','product','vet','pet_partner');

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  subject_type review_subject NOT NULL,
  subject_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  verified_purchase boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, subject_type, subject_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_select_all ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY reviews_insert_own ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY reviews_update_own ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY reviews_delete_own ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reviews_subject ON public.reviews(subject_type, subject_id);

-- Auto-flag verified purchases
CREATE OR REPLACE FUNCTION public.set_verified_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subject_type = 'provider' THEN
    NEW.verified_purchase := EXISTS (
      SELECT 1 FROM public.service_bookings
      WHERE provider_id = NEW.subject_id
        AND customer_id = NEW.reviewer_id
        AND status IN ('confirmed','completed')
    );
  ELSIF NEW.subject_type = 'product' THEN
    NEW.verified_purchase := EXISTS (
      SELECT 1 FROM public.shop_order_items i
      JOIN public.shop_orders o ON o.id = i.order_id
      WHERE i.product_id = NEW.subject_id
        AND o.customer_id = NEW.reviewer_id
    );
  ELSIF NEW.subject_type = 'vet' THEN
    NEW.verified_purchase := EXISTS (
      SELECT 1 FROM public.vet_consults
      WHERE vet_id = NEW.subject_id
        AND owner_id = NEW.reviewer_id
        AND status = 'completed'
    );
  ELSIF NEW.subject_type = 'pet_partner' THEN
    NEW.verified_purchase := EXISTS (
      SELECT 1 FROM public.mating_requests
      WHERE status = 'agreed'
        AND ((from_owner_id = NEW.reviewer_id AND to_pet_id = NEW.subject_id)
          OR (to_owner_id = NEW.reviewer_id AND from_pet_id = NEW.subject_id))
    );
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_verified_purchase() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_set_verified_purchase
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.set_verified_purchase();

-- Aggregate view
CREATE VIEW public.subject_ratings
WITH (security_invoker = true)
AS
SELECT
  subject_type,
  subject_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(*)::int AS review_count
FROM public.reviews
GROUP BY subject_type, subject_id;

GRANT SELECT ON public.subject_ratings TO authenticated, anon;