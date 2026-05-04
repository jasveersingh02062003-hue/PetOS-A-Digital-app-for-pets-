-- Phase 1 Public SEO Funnel RLS policies

-- Enable read access to all users (including anon) for public data
-- breed_profiles
DROP POLICY IF EXISTS "Anon can view breed profiles" ON "public"."breed_profiles";
CREATE POLICY "Anon can view breed profiles" ON "public"."breed_profiles" FOR SELECT TO public USING (true);

-- pet_listings
DROP POLICY IF EXISTS "Anon can view active pet listings" ON "public"."pet_listings";
CREATE POLICY "Anon can view active pet listings" ON "public"."pet_listings" FOR SELECT TO public USING (status = 'active' AND active = true);

-- mating_listings
DROP POLICY IF EXISTS "Anon can view active mating listings" ON "public"."mating_listings";
CREATE POLICY "Anon can view active mating listings" ON "public"."mating_listings" FOR SELECT TO public USING (active = true);

-- service_providers
DROP POLICY IF EXISTS "Anon can view active service providers" ON "public"."service_providers";
CREATE POLICY "Anon can view active service providers" ON "public"."service_providers" FOR SELECT TO public USING (active = true);

-- missing_pets
DROP POLICY IF EXISTS "Anon can view active missing pets" ON "public"."missing_pets";
CREATE POLICY "Anon can view active missing pets" ON "public"."missing_pets" FOR SELECT TO public USING (status = 'active');

-- posts
DROP POLICY IF EXISTS "Anon can view active posts" ON "public"."posts";
CREATE POLICY "Anon can view active posts" ON "public"."posts" FOR SELECT TO public USING (active = true);
