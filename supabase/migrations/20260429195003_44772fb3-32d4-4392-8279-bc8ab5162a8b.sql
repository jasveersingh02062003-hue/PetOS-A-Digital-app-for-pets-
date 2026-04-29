ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS health_tests JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pet_listings.health_tests IS
  'Array of {code, label, result, verified_by?, verified_at?} health screening entries. e.g. [{"code":"hips_ofa","label":"Hips OFA","result":"Good"}]';