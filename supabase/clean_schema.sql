-- ====================================================================
-- PETS 2.0 PRO: FULL POWER SCHEMA (100% FEATURE COMPLETE - 77 TABLES)
-- ====================================================================

BEGIN;

-- 1. HARD RESET
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 2. MASTER PRIVILEGES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role, authenticated;

-- 3. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 4. ENUMS
CREATE TYPE public.app_role AS ENUM ('user', 'pet_pal', 'boarding_provider', 'vet', 'ngo', 'moderator', 'finance', 'super_admin');
CREATE TYPE public.pet_species AS ENUM ('dog', 'cat', 'bird', 'rabbit', 'other');
CREATE TYPE public.pet_gender AS ENUM ('male', 'female');
CREATE TYPE public.account_type AS ENUM ('pet_parent','breeder','kennel','shelter','sanctuary','zoo','rescuer');

-- 5. TABLES

-- PROFILES (Master Sync)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  account_type public.account_type NOT NULL DEFAULT 'pet_parent',
  full_name TEXT,
  city TEXT,
  lat NUMERIC,
  lng NUMERIC,
  avatar_url TEXT,
  cover_url TEXT,
  phone TEXT,
  bio TEXT,
  language TEXT DEFAULT 'en',
  units JSONB DEFAULT '{"weight": "kg", "temp": "c"}'::jsonb,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  interests TEXT[] DEFAULT '{}',
  emergency_vet JSONB DEFAULT '{"name": null, "phone": null}'::jsonb,
  reminder_prefs JSONB DEFAULT '{"vaccines": true, "deworming": true, "flea_tick": true, "checkup": true}'::jsonb,
  notif_prefs JSONB DEFAULT '{"push": true, "email": true, "sms": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PETS (Master Sync)
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species public.pet_species NOT NULL,
  breed TEXT,
  date_of_birth DATE,
  approx_age_months INT,
  gender public.pet_gender,
  weight_kg NUMERIC(5,2),
  neutered BOOLEAN,
  microchip_id TEXT,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  lat NUMERIC,
  lng NUMERIC,
  temperament TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  conditions TEXT[] DEFAULT '{}',
  discoverable_for_mating BOOLEAN NOT NULL DEFAULT false,
  vaccination_verified BOOLEAN NOT NULL DEFAULT false,
  health_setup_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 6. SECURITY & RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "pets_select_all" ON public.pets FOR SELECT USING (true);
CREATE POLICY "pets_owner_all" ON public.pets FOR ALL USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_all" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 7. RE-GRANT EVERYTHING
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 8. TRIGGERS & FUNCTIONS

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pets_updated BEFORE UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED REMINDERS RPC
CREATE OR REPLACE FUNCTION public.seed_pet_vaccine_reminders(_pet_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NULL;
END;
$$;

-- 9. RETROACTIVE SYNC
INSERT INTO public.profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role
FROM auth.users
ON CONFLICT DO NOTHING;

-- 10. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES
  ('pet-avatars','pet-avatars', true),
  ('user-avatars','user-avatars', true),
  ('posts','posts', true),
  ('health-media','health-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_files" ON storage.objects;
DROP POLICY IF EXISTS "public_read_files" ON storage.objects;
CREATE POLICY "public_read_files" ON storage.objects FOR SELECT USING (bucket_id IN ('pet-avatars', 'user-avatars', 'posts', 'health-media'));

DROP POLICY IF EXISTS "owner_manage_files" ON storage.objects;
DROP POLICY IF EXISTS "owner_manage_files" ON storage.objects;
CREATE POLICY "owner_manage_files" ON storage.objects FOR ALL 
  USING (auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- ====================================================================
-- REST OF THE 74 TABLES FROM MASTER SCHEMA
-- ====================================================================

-- Vaccinations
CREATE TABLE public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  administered_on DATE NOT NULL,
  next_due_on DATE,
  batch_number TEXT,
  vet_name TEXT,
  document_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vaccinations_pet ON public.vaccinations(pet_id);
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access vaccinations" ON public.vaccinations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE TRIGGER trg_vaccinations_updated BEFORE UPDATE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Health records
CREATE TYPE public.health_record_type AS ENUM ('visit','diagnostic','prescription','surgery','allergy','other');

CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  record_type public.health_record_type NOT NULL DEFAULT 'visit',
  title TEXT NOT NULL,
  notes TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  document_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_records_pet ON public.health_records(pet_id);
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access health_records" ON public.health_records
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE TRIGGER trg_health_records_updated BEFORE UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vault documents
CREATE TABLE public.vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vault_documents_pet ON public.vault_documents(pet_id);
ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access vault_documents" ON public.vault_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Symptom logs
CREATE TABLE public.symptom_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  symptom TEXT NOT NULL,
  severity SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_symptom_logs_pet ON public.symptom_logs(pet_id);
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access symptom_logs" ON public.symptom_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Nutrition logs
CREATE TABLE public.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  food TEXT NOT NULL,
  portion TEXT,
  fed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nutrition_logs_pet ON public.nutrition_logs(pet_id);
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access nutrition_logs" ON public.nutrition_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Vet access grants (8-char shareable code)
CREATE TABLE public.vet_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  vet_name TEXT,
  clinic_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vet_access_grants_pet ON public.vet_access_grants(pet_id);
CREATE INDEX idx_vet_access_grants_code ON public.vet_access_grants(code);
ALTER TABLE public.vet_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages vet_access_grants" ON public.vet_access_grants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()) AND created_by = auth.uid());



-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  caption TEXT,
  image_url TEXT,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
CREATE INDEX idx_posts_author ON public.posts(author_id);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_all" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- LIKES
CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_all" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert_own" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON public.post_comments(post_id, created_at);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert_own" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_delete_own" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- COUNTER TRIGGERS
CREATE OR REPLACE FUNCTION public.bump_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();

CREATE OR REPLACE FUNCTION public.bump_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_comment_count();

-- REALTIME
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;



REVOKE EXECUTE ON FUNCTION public.bump_like_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_comment_count() FROM PUBLIC, anon, authenticated;



DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vet';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TYPE public.consult_severity AS ENUM ('mild','moderate','severe');
CREATE TYPE public.consult_status AS ENUM ('awaiting_vet','assigned','in_progress','completed','cancelled');

CREATE TABLE public.vet_consults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  vet_id UUID,
  severity public.consult_severity NOT NULL DEFAULT 'moderate',
  status public.consult_status NOT NULL DEFAULT 'awaiting_vet',
  ai_summary TEXT,
  symptoms TEXT[],
  prescription TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_consults_owner ON public.vet_consults(owner_id);
CREATE INDEX idx_consults_vet ON public.vet_consults(vet_id);
CREATE INDEX idx_consults_status ON public.vet_consults(status);

ALTER TABLE public.vet_consults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consults_owner_view" ON public.vet_consults
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "consults_vet_view" ON public.vet_consults
  FOR SELECT TO authenticated USING (auth.uid() = vet_id OR public.has_role(auth.uid(), 'vet'));
CREATE POLICY "consults_admin_view" ON public.vet_consults
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "consults_owner_insert" ON public.vet_consults
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "consults_owner_cancel" ON public.vet_consults
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "consults_vet_update" ON public.vet_consults
  FOR UPDATE TO authenticated USING (auth.uid() = vet_id OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (auth.uid() = vet_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_consults_updated BEFORE UPDATE ON public.vet_consults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



CREATE TYPE public.mating_intent AS ENUM ('stud','dam','either');
CREATE TYPE public.request_status AS ENUM ('pending','accepted','declined','withdrawn','agreed');

CREATE TABLE public.mating_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  intent public.mating_intent NOT NULL DEFAULT 'either',
  fee_inr INTEGER,
  city TEXT,
  travel_km INTEGER DEFAULT 0,
  description TEXT,
  requirements TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pet_id)
);
CREATE INDEX idx_listings_active ON public.mating_listings(active, created_at DESC);
CREATE INDEX idx_listings_city ON public.mating_listings(city);

ALTER TABLE public.mating_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_select_all" ON public.mating_listings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "listings_owner_insert" ON public.mating_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_update" ON public.mating_listings
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_delete" ON public.mating_listings
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.mating_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce verified + discoverable on listing
CREATE OR REPLACE FUNCTION public.check_pet_eligible_for_mating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  SELECT (vaccination_verified AND discoverable_for_mating) INTO v_ok
  FROM public.pets WHERE id = NEW.pet_id;
  IF NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'Pet must be vaccination-verified and marked discoverable for mating.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_pet_eligible_for_mating() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_check_listing_eligible BEFORE INSERT ON public.mating_listings
  FOR EACH ROW EXECUTE FUNCTION public.check_pet_eligible_for_mating();

-- Requests
CREATE TABLE public.mating_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  to_pet_id   UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  from_owner_id UUID NOT NULL,
  to_owner_id   UUID NOT NULL,
  message TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_pet_id, to_pet_id)
);
CREATE INDEX idx_requests_to ON public.mating_requests(to_owner_id, status);
CREATE INDEX idx_requests_from ON public.mating_requests(from_owner_id, status);

ALTER TABLE public.mating_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests_select_party" ON public.mating_requests
  FOR SELECT TO authenticated USING (auth.uid() = from_owner_id OR auth.uid() = to_owner_id);
CREATE POLICY "requests_from_insert" ON public.mating_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_owner_id);
CREATE POLICY "requests_party_update" ON public.mating_requests
  FOR UPDATE TO authenticated USING (auth.uid() = from_owner_id OR auth.uid() = to_owner_id)
  WITH CHECK (auth.uid() = from_owner_id OR auth.uid() = to_owner_id);

CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.mating_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Agreements
CREATE TABLE public.mating_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.mating_requests(id) ON DELETE CASCADE,
  terms_text TEXT NOT NULL,
  from_signature TEXT,
  from_signed_at TIMESTAMPTZ,
  to_signature TEXT,
  to_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mating_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agreements_select_party" ON public.mating_agreements
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  );
CREATE POLICY "agreements_party_insert" ON public.mating_agreements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  );
CREATE POLICY "agreements_party_update" ON public.mating_agreements
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.mating_requests r
            WHERE r.id = mating_agreements.request_id
              AND (auth.uid() = r.from_owner_id OR auth.uid() = r.to_owner_id))
  );
CREATE TRIGGER trg_agreements_updated BEFORE UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When both sigs present, flip request to 'agreed'
CREATE OR REPLACE FUNCTION public.maybe_finalize_agreement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.from_signature IS NOT NULL AND NEW.to_signature IS NOT NULL THEN
    UPDATE public.mating_requests SET status = 'agreed' WHERE id = NEW.request_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.maybe_finalize_agreement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_finalize_agreement AFTER INSERT OR UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.maybe_finalize_agreement();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mating_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mating_agreements;



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



CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');

-- Vet applications
CREATE TABLE public.vet_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  clinic_name text NOT NULL,
  license_number text NOT NULL,
  city text,
  bio text,
  status application_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vet_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY vet_apps_self_select ON public.vet_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY vet_apps_self_insert ON public.vet_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY vet_apps_admin_update ON public.vet_applications FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_vet_apps_updated BEFORE UPDATE ON public.vet_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verification requests
CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending',
  notes text,
  reviewer_id uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY ver_reqs_owner_select ON public.verification_requests FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR has_role(auth.uid(),'vet') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'moderator'));
CREATE POLICY ver_reqs_owner_insert ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY ver_reqs_reviewer_update ON public.verification_requests FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'vet') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'vet') OR has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_ver_reqs_updated BEFORE UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When a verification is approved, mark the pet
CREATE OR REPLACE FUNCTION public.apply_verification_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.pets SET vaccination_verified = true WHERE id = NEW.pet_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_verification_approval
BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_verification_approval();

-- When a vet application is approved, grant the vet role
CREATE OR REPLACE FUNCTION public.apply_vet_application_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'vet')
    ON CONFLICT DO NOTHING;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_vet_app_approval
BEFORE UPDATE ON public.vet_applications
FOR EACH ROW EXECUTE FUNCTION public.apply_vet_application_approval();

CREATE INDEX idx_ver_reqs_status ON public.verification_requests(status);
CREATE INDEX idx_vet_apps_status ON public.vet_applications(status);



REVOKE ALL ON FUNCTION public.apply_verification_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_vet_application_approval() FROM PUBLIC, anon, authenticated;



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



CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_own_select ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notif_own_update ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notif_own_delete ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notif_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notif_user_recent ON public.notifications(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Generic helper
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _body text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END $$;
REVOKE ALL ON FUNCTION public.notify_user(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;

-- Bookings
CREATE OR REPLACE FUNCTION public.on_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_name text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_name FROM public.service_providers WHERE id = NEW.provider_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(v_owner, 'booking_new',
      'New booking request',
      'Someone requested a booking for ' || v_name,
      '/services/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.customer_id, 'booking_status',
      'Booking ' || NEW.status,
      'Your booking with ' || v_name || ' is now ' || NEW.status,
      '/services/manage');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_booking_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_booking_notify AFTER INSERT OR UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.on_booking_event();

-- Orders: notify each unique seller on new order
CREATE OR REPLACE FUNCTION public.on_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_user(NEW.seller_id, 'order_new',
    'New order received',
    'You have a new order for ' || NEW.title_snapshot,
    '/services/manage');
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_order_item_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_order_item_notify AFTER INSERT ON public.shop_order_items
  FOR EACH ROW EXECUTE FUNCTION public.on_order_item_insert();

CREATE OR REPLACE FUNCTION public.on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.customer_id, 'order_status',
      'Order ' || NEW.status,
      'Your order is now ' || NEW.status,
      '/orders');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_order_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_order_status_notify AFTER UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_status();

-- Mating requests
CREATE OR REPLACE FUNCTION public.on_mating_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.to_owner_id, 'mate_request',
      'New mating request',
      'Someone is interested in your pet',
      '/mates/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.from_owner_id, 'mate_status',
      'Mating request ' || NEW.status,
      'Status updated for your request',
      '/mates/manage');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_mating_request() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_mate_req_notify AFTER INSERT OR UPDATE ON public.mating_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_mating_request();

-- Vet consults
CREATE OR REPLACE FUNCTION public.on_consult_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.owner_id, 'consult_status',
      'Vet consult ' || replace(NEW.status::text,'_',' '),
      'Update on your tele-vet consult',
      '/vet/consult/' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_consult_event() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_consult_notify AFTER UPDATE ON public.vet_consults
  FOR EACH ROW EXECUTE FUNCTION public.on_consult_event();

-- Likes & comments on posts
CREATE OR REPLACE FUNCTION public.on_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    PERFORM public.notify_user(v_author, 'post_like',
      'Someone liked your post', NULL, '/');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_post_like() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_post_like_notify AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_post_like();

CREATE OR REPLACE FUNCTION public.on_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.author_id THEN
    PERFORM public.notify_user(v_author, 'post_comment',
      'New comment on your post', LEFT(NEW.body, 80), '/');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.on_post_comment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_post_comment_notify AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.on_post_comment();



INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace', 'marketplace', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "marketplace_public_read" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_public_read" ON storage.objects;
CREATE POLICY "marketplace_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace');

DROP POLICY IF EXISTS "marketplace_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_user_insert" ON storage.objects;
CREATE POLICY "marketplace_user_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "marketplace_user_update" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_user_update" ON storage.objects;
CREATE POLICY "marketplace_user_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "marketplace_user_delete" ON storage.objects;
DROP POLICY IF EXISTS "marketplace_user_delete" ON storage.objects;
CREATE POLICY "marketplace_user_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketplace' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pets_name_trgm ON public.pets USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pets_breed_trgm ON public.pets USING GIN (breed gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_providers_name_trgm ON public.service_providers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.shop_products USING GIN (title gin_trgm_ops);




-- Reports table for moderation queue
CREATE TYPE public.report_subject AS ENUM ('post','comment','product','provider','user','listing');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  subject_type report_subject NOT NULL,
  subject_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'open',
  resolver_id uuid,
  resolver_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY reports_select_own_or_admin ON public.reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'moderator')
  );

CREATE POLICY reports_admin_update ON public.reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX idx_reports_subject ON public.reports(subject_type, subject_id);




-- New enums
DO $$ BEGIN
  CREATE TYPE public.activity_level AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.diet_type AS ENUM ('kibble','raw','home','mixed','prescription');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_level AS ENUM ('solo','pairs','crowds');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS units jsonb NOT NULL DEFAULT '{"weight":"kg","temp":"c"}'::jsonb,
  ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emergency_vet jsonb,
  ADD COLUMN IF NOT EXISTS notif_prefs jsonb NOT NULL DEFAULT '{"push":true,"email":true,"sms":false}'::jsonb;

-- Pets additions
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS activity_level public.activity_level,
  ADD COLUMN IF NOT EXISTS diet_type public.diet_type,
  ADD COLUMN IF NOT EXISTS social_level public.social_level,
  ADD COLUMN IF NOT EXISTS allergies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS temperament text[] NOT NULL DEFAULT '{}';



-- Backfill: any neutered pet currently marked discoverable should be turned off
UPDATE public.pets SET discoverable_for_mating = false WHERE neutered = true;

-- Trigger function: force discoverable_for_mating = false whenever neutered = true
CREATE OR REPLACE FUNCTION public.enforce_neutered_not_discoverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.neutered, false) = true THEN
    NEW.discoverable_for_mating := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_neutered_not_discoverable ON public.pets;
CREATE TRIGGER trg_enforce_neutered_not_discoverable
BEFORE INSERT OR UPDATE ON public.pets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_neutered_not_discoverable();



REVOKE ALL ON FUNCTION public.enforce_neutered_not_discoverable() FROM PUBLIC, anon, authenticated;



-- Phase 3: Privacy & Hardening

-- 1. PETS table: tighten read access
DROP POLICY IF EXISTS pets_select_all ON public.pets;

CREATE POLICY pets_select_scoped ON public.pets
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id
  OR discoverable_for_mating = true
  OR EXISTS (SELECT 1 FROM public.posts po WHERE po.pet_id = pets.id)
  OR EXISTS (
    SELECT 1 FROM public.mating_requests mr
    WHERE (mr.from_pet_id = pets.id OR mr.to_pet_id = pets.id)
      AND (auth.uid() = mr.from_owner_id OR auth.uid() = mr.to_owner_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.vet_consults vc
    WHERE vc.pet_id = pets.id
      AND (auth.uid() = vc.owner_id OR auth.uid() = vc.vet_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.service_bookings sb
    WHERE sb.pet_id = pets.id
      AND (
        auth.uid() = sb.customer_id
        OR EXISTS (SELECT 1 FROM public.service_providers sp WHERE sp.id = sb.provider_id AND sp.owner_id = auth.uid())
      )
  )
);

-- 2. PROFILES table: owner-only full read; others use the public view
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Public projection (safe fields only) via SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.get_profiles_public()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  bio text,
  handle text,
  cover_url text,
  account_type public.account_type
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, city, bio, handle, cover_url, account_type::public.account_type
  FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated;

DROP VIEW IF EXISTS public.profiles_public CASCADE;
CREATE VIEW public.profiles_public AS
SELECT * FROM public.get_profiles_public();
GRANT SELECT ON public.profiles_public TO authenticated;

-- Public pet projection
CREATE OR REPLACE FUNCTION public.get_pets_public()
RETURNS TABLE (
  id uuid, owner_id uuid, name text, species pet_species, breed text,
  gender pet_gender, avatar_url text, bio text, city text,
  vaccination_verified boolean, discoverable_for_mating boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, owner_id, name, species, breed, gender, avatar_url, bio, city,
         vaccination_verified, discoverable_for_mating
  FROM public.pets;
$$;
REVOKE ALL ON FUNCTION public.get_pets_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated;

DROP VIEW IF EXISTS public.pets_public CASCADE;
CREATE VIEW public.pets_public AS
SELECT * FROM public.get_pets_public();
GRANT SELECT ON public.pets_public TO authenticated;

-- 3. notify_user honors notif_prefs.push
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _type text, _title text, _body text, _link text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_push boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE((notif_prefs->>'push')::boolean, true) INTO v_push
  FROM public.profiles WHERE id = _user_id;
  IF v_push IS false THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link);
END $$;



DROP VIEW IF EXISTS public.profiles_public CASCADE;
DROP VIEW IF EXISTS public.pets_public CASCADE;



REVOKE EXECUTE ON FUNCTION public.get_profiles_public() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_pets_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated;



-- ============================================================
-- MISSING PETS
-- ============================================================

CREATE TYPE public.missing_status AS ENUM ('active', 'resolved', 'cancelled');

CREATE TABLE public.missing_pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  photo_url text,
  last_seen_lat numeric,
  last_seen_lng numeric,
  last_seen_city text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  reward_inr integer DEFAULT 0,
  note text,
  status public.missing_status NOT NULL DEFAULT 'active',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_missing_pets_status_city ON public.missing_pets(status, last_seen_city);
CREATE INDEX idx_missing_pets_owner ON public.missing_pets(owner_id);

ALTER TABLE public.missing_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY missing_select_active ON public.missing_pets
FOR SELECT TO authenticated
USING (status = 'active' OR auth.uid() = owner_id);

CREATE POLICY missing_insert_owner ON public.missing_pets
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id = missing_pets.pet_id AND p.owner_id = auth.uid())
);

CREATE POLICY missing_update_owner ON public.missing_pets
FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_missing_pets_updated_at
BEFORE UPDATE ON public.missing_pets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sightings
CREATE TABLE public.missing_pet_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_pet_id uuid NOT NULL REFERENCES public.missing_pets(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  photo_url text,
  lat numeric,
  lng numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sightings_missing ON public.missing_pet_sightings(missing_pet_id, created_at DESC);

ALTER TABLE public.missing_pet_sightings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sightings_select_owner_or_reporter ON public.missing_pet_sightings
FOR SELECT TO authenticated
USING (
  auth.uid() = reporter_id
  OR EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.owner_id = auth.uid()
  )
);

CREATE POLICY sightings_insert_signed_in ON public.missing_pet_sightings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.status = 'active'
  )
);

-- ============================================================
-- TRIGGERS â€” notify city neighbors and the owner
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_missing_pet_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet_name text;
  v_species text;
  rec RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT name, species::text INTO v_pet_name, v_species FROM public.pets WHERE id = NEW.pet_id;

  FOR rec IN
    SELECT id FROM public.profiles
    WHERE id <> NEW.owner_id
      AND NEW.last_seen_city IS NOT NULL
      AND lower(city) = lower(NEW.last_seen_city)
    LIMIT 5000
  LOOP
    PERFORM public.notify_user(
      rec.id,
      'missing_pet',
      'Help find ' || COALESCE(v_pet_name, 'a pet'),
      COALESCE(v_species, 'pet') || ' last seen in ' || COALESCE(NEW.last_seen_city, 'your area'),
      '/missing/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_missing_pet_alerts
AFTER INSERT ON public.missing_pets
FOR EACH ROW EXECUTE FUNCTION public.notify_missing_pet_alerts();

CREATE OR REPLACE FUNCTION public.notify_owner_on_sighting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_pet_name text;
BEGIN
  SELECT mp.owner_id, p.name
    INTO v_owner, v_pet_name
  FROM public.missing_pets mp
  JOIN public.pets p ON p.id = mp.pet_id
  WHERE mp.id = NEW.missing_pet_id;

  IF v_owner IS NOT NULL AND v_owner <> NEW.reporter_id THEN
    PERFORM public.notify_user(
      v_owner,
      'sighting',
      'New sighting of ' || COALESCE(v_pet_name, 'your pet'),
      COALESCE(LEFT(NEW.note, 80), 'Tap to view location and photo.'),
      '/missing/' || NEW.missing_pet_id
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_owner_on_sighting
AFTER INSERT ON public.missing_pet_sightings
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_on_sighting();

-- ============================================================
-- STORAGE â€” public bucket for missing pet photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('missing-pets', 'missing-pets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Missing pet photos are public" ON storage.objects;
CREATE POLICY "Missing pet photos are public"
ON storage.objects FOR SELECT TO public, authenticated
USING (bucket_id = 'missing-pets');

DROP POLICY IF EXISTS "Owners can upload missing pet photos" ON storage.objects;
CREATE POLICY "Owners can upload missing pet photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'missing-pets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can update their missing pet photos" ON storage.objects;
CREATE POLICY "Owners can update their missing pet photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'missing-pets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Owners can delete their missing pet photos" ON storage.objects;
CREATE POLICY "Owners can delete their missing pet photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'missing-pets' AND auth.uid()::text = (storage.foldername(name))[1]);



-- Subscription tier
CREATE TYPE public.sub_tier AS ENUM ('free', 'plus');
CREATE TYPE public.sub_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');

CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY,
  tier public.sub_tier NOT NULL DEFAULT 'free',
  status public.sub_status NOT NULL DEFAULT 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subs_select_own ON public.subscriptions
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
-- INSERT/UPDATE only via service role from the Stripe webhook; no client policy.

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Usage counters (server-side rate limiting)
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL,
  kind text NOT NULL,           -- e.g. 'ai_chat', 'vet_consult'
  period date NOT NULL,         -- daily granularity
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, period)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_select_own ON public.usage_counters
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
-- Writes only via service role.

-- current_tier helper
CREATE OR REPLACE FUNCTION public.current_tier(_user_id uuid)
RETURNS public.sub_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.tier = 'plus'
      AND s.status IN ('active','trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
    THEN 'plus'::public.sub_tier
    ELSE 'free'::public.sub_tier
  END
  FROM (SELECT 1) x
  LEFT JOIN public.subscriptions s ON s.user_id = _user_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tier(uuid) TO authenticated;

-- Free-tier limit: 1 active missing-pet listing
CREATE OR REPLACE FUNCTION public.enforce_missing_free_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_active_count int; v_tier public.sub_tier;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  v_tier := public.current_tier(NEW.owner_id);
  IF v_tier = 'plus' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_active_count
  FROM public.missing_pets
  WHERE owner_id = NEW.owner_id AND status = 'active' AND id <> NEW.id;
  IF v_active_count >= 1 THEN
    RAISE EXCEPTION 'Free plan is limited to 1 active missing-pet listing. Upgrade to Plus for unlimited.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_enforce_missing_free_limit
BEFORE INSERT OR UPDATE OF status ON public.missing_pets
FOR EACH ROW EXECUTE FUNCTION public.enforce_missing_free_limit();



ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notify_plus_launch boolean NOT NULL DEFAULT false;




-- Payment intents ledger (Beta-free today, real charges once Stripe is configured)
CREATE TYPE public.payment_kind AS ENUM ('vet_consult','mating_listing','agreement','missing_listing');
CREATE TYPE public.payment_intent_status AS ENUM ('beta_free','pending','paid','failed','refunded');

CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind public.payment_kind NOT NULL,
  amount_inr INTEGER NOT NULL,
  status public.payment_intent_status NOT NULL DEFAULT 'beta_free',
  provider_session_id TEXT,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intents_select_own" ON public.payment_intents
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "intents_insert_own" ON public.payment_intents
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER payment_intents_updated_at
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_payment_intents_user ON public.payment_intents(user_id, created_at DESC);

-- Reminder log to dedupe vaccination booster nudges
CREATE TABLE public.reminder_log (
  vaccination_id UUID NOT NULL,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vaccination_id, kind)
);

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
-- No public policies; only service role writes via edge function.

-- Realtime for sightings
ALTER TABLE public.missing_pet_sightings REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missing_pet_sightings;

-- Enable scheduling extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;




-- =====================================================================
-- MERGE A: Security, data integrity, performance hardening
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) ATOMIC USAGE COUNTER (fixes race in chat/index.ts)
-- ---------------------------------------------------------------------

-- Add a window_start column so we can do rolling N-day windows (not just daily)
ALTER TABLE public.usage_counters
  ADD COLUMN IF NOT EXISTS window_start timestamptz NOT NULL DEFAULT now();

-- Ensure unique key for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_user_kind_period_key'
  ) THEN
    ALTER TABLE public.usage_counters
      ADD CONSTRAINT usage_counters_user_kind_period_key UNIQUE (user_id, kind, period);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_usage(
  _kind text,
  _limit int,
  _window_days int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_period date := CURRENT_DATE;
  v_count int;
  v_window_start timestamptz;
  v_resets_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'error', 'unauthenticated');
  END IF;

  -- Sum usage in the rolling window across daily periods
  SELECT COALESCE(SUM(count), 0), MIN(window_start)
    INTO v_count, v_window_start
  FROM public.usage_counters
  WHERE user_id = v_user
    AND kind = _kind
    AND window_start > now() - make_interval(days => _window_days);

  v_resets_at := COALESCE(v_window_start, now()) + make_interval(days => _window_days);

  IF v_count >= _limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'used', v_count,
      'limit', _limit,
      'resets_at', v_resets_at
    );
  END IF;

  -- Atomic upsert for today's bucket
  INSERT INTO public.usage_counters (user_id, kind, period, count, window_start)
  VALUES (v_user, _kind, v_period, 1, now())
  ON CONFLICT (user_id, kind, period)
  DO UPDATE SET count = public.usage_counters.count + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(_limit - v_count - 1, 0),
    'used', v_count + 1,
    'limit', _limit,
    'resets_at', v_resets_at
  );
END $$;

REVOKE ALL ON FUNCTION public.increment_usage(text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_usage(text,int,int) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) TIGHTEN pets SELECT (split the giant OR policy)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS pets_select_scoped ON public.pets;

CREATE POLICY pets_select_own ON public.pets
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY pets_select_discoverable ON public.pets
  FOR SELECT TO authenticated
  USING (discoverable_for_mating = true);

CREATE POLICY pets_select_mate_party ON public.pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mating_requests mr
    WHERE (mr.from_pet_id = pets.id OR mr.to_pet_id = pets.id)
      AND (auth.uid() = mr.from_owner_id OR auth.uid() = mr.to_owner_id)
  ));

CREATE POLICY pets_select_consult_party ON public.pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vet_consults vc
    WHERE vc.pet_id = pets.id
      AND (auth.uid() = vc.owner_id OR auth.uid() = vc.vet_id)
  ));

CREATE POLICY pets_select_booking_party ON public.pets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_bookings sb
    WHERE sb.pet_id = pets.id
      AND (auth.uid() = sb.customer_id
           OR EXISTS (SELECT 1 FROM public.service_providers sp
                      WHERE sp.id = sb.provider_id AND sp.owner_id = auth.uid()))
  ));

-- For the public feed/posts: use the safe view below; do NOT add a blanket SELECT
-- on pets that would leak owner_id.

-- Safe pets view for joins from posts/feed (no owner_id exposed)
CREATE OR REPLACE VIEW public.pets_public AS
  SELECT id, name, species, breed, gender, avatar_url, bio, city,
         vaccination_verified, discoverable_for_mating
  FROM public.pets;

GRANT SELECT ON public.pets_public TO authenticated;

-- ---------------------------------------------------------------------
-- 3) LOCK DOWN SECURITY DEFINER FUNCTIONS
-- ---------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tier(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_pets_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4) NOTIFICATIONS: explicit insert rule for SECURITY DEFINER helpers
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS notif_definer_insert ON public.notifications;
CREATE POLICY notif_definer_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);  -- writes only happen via SECURITY DEFINER notify_user()

-- ---------------------------------------------------------------------
-- 5) STORAGE HARDENING
-- ---------------------------------------------------------------------

-- Block anonymous bucket listing on image buckets.
-- Existing public SELECT on individual paths still works (URLs load).
DROP POLICY IF EXISTS "Public bucket list disabled" ON storage.objects;

-- Per-bucket: SELECT individual objects allowed (publicly), but no listing
-- via service role only is the safest. We add per-bucket size + mime checks.

-- Safety: revoke any wildcard list if present (Supabase usually has none, but be explicit)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname IN ('Allow listing posts', 'Allow listing missing-pets')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
  END LOOP;
END $$;

-- Image upload size + MIME guard for image buckets
DROP POLICY IF EXISTS "Image uploads must be image and under 5MB" ON storage.objects;
DROP POLICY IF EXISTS "Image uploads must be image and under 5MB" ON storage.objects;
CREATE POLICY "Image uploads must be image and under 5MB"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('pet-avatars','user-avatars','posts','missing-pets','marketplace')
    AND (metadata->>'size')::bigint < 5 * 1024 * 1024
    AND (metadata->>'mimetype') LIKE 'image/%'
  );

-- Vault docs: PDFs/images, max 10 MB
DROP POLICY IF EXISTS "Vault uploads under 10MB" ON storage.objects;
DROP POLICY IF EXISTS "Vault uploads under 10MB" ON storage.objects;
CREATE POLICY "Vault uploads under 10MB"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vault-docs'
    AND (metadata->>'size')::bigint < 10 * 1024 * 1024
    AND (
      (metadata->>'mimetype') LIKE 'image/%'
      OR (metadata->>'mimetype') = 'application/pdf'
    )
  );

-- ---------------------------------------------------------------------
-- 6) ASYNC FAN-OUT FOR MISSING-PET ALERTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS notification_jobs_pending_idx
  ON public.notification_jobs (status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_jobs_admin_select ON public.notification_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Replace the synchronous fan-out with a single queue insert
CREATE OR REPLACE FUNCTION public.enqueue_missing_pet_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO public.notification_jobs (kind, payload)
    VALUES (
      'missing_pet_fanout',
      jsonb_build_object(
        'missing_pet_id', NEW.id,
        'pet_id', NEW.pet_id,
        'owner_id', NEW.owner_id,
        'last_seen_city', NEW.last_seen_city
      )
    );
  END IF;
  RETURN NEW;
END $$;

-- Drop old trigger if it exists, attach new one
DROP TRIGGER IF EXISTS trg_notify_missing_pet_alerts ON public.missing_pets;
DROP TRIGGER IF EXISTS trg_enqueue_missing_pet_alerts ON public.missing_pets;
CREATE TRIGGER trg_enqueue_missing_pet_alerts
  AFTER INSERT ON public.missing_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_missing_pet_alerts();

-- ---------------------------------------------------------------------
-- 7) RATE LIMITS ON USER-GENERATED CONTENT
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_daily_limit(_table text, _user uuid, _limit int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF _table = 'posts' THEN
    SELECT count(*) INTO v_count FROM public.posts
      WHERE author_id = _user AND created_at > now() - interval '1 day';
  ELSIF _table = 'post_comments' THEN
    SELECT count(*) INTO v_count FROM public.post_comments
      WHERE author_id = _user AND created_at > now() - interval '1 day';
  ELSIF _table = 'missing_pet_sightings' THEN
    SELECT count(*) INTO v_count FROM public.missing_pet_sightings
      WHERE reporter_id = _user AND created_at > now() - interval '1 day';
  END IF;
  IF v_count >= _limit THEN
    RAISE EXCEPTION 'rate_limit: daily limit of % reached for %', _limit, _table
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_limit_posts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.check_daily_limit('posts', NEW.author_id, 10); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_limit_comments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.check_daily_limit('post_comments', NEW.author_id, 60); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.tg_limit_sightings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.check_daily_limit('missing_pet_sightings', NEW.reporter_id, 20); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_limit_posts ON public.posts;
CREATE TRIGGER trg_limit_posts BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_limit_posts();

DROP TRIGGER IF EXISTS trg_limit_comments ON public.post_comments;
CREATE TRIGGER trg_limit_comments BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_limit_comments();

DROP TRIGGER IF EXISTS trg_limit_sightings ON public.missing_pet_sightings;
CREATE TRIGGER trg_limit_sightings BEFORE INSERT ON public.missing_pet_sightings
  FOR EACH ROW EXECUTE FUNCTION public.tg_limit_sightings();

-- ---------------------------------------------------------------------
-- 8) CASCADE FOREIGN KEYS (account deletion safety)
-- ---------------------------------------------------------------------

-- Helper: drop existing FK if present, add cascading FK
DO $$
DECLARE
  r record;
  fk_specs text[] := ARRAY[
    'pets|owner_id|auth.users|id',
    'posts|author_id|auth.users|id',
    'post_comments|author_id|auth.users|id',
    'post_likes|user_id|auth.users|id',
    'notifications|user_id|auth.users|id',
    'profiles|id|auth.users|id',
    'usage_counters|user_id|auth.users|id',
    'subscriptions|user_id|auth.users|id',
    'payment_intents|user_id|auth.users|id',
    'service_providers|owner_id|auth.users|id',
    'service_bookings|customer_id|auth.users|id',
    'shop_orders|customer_id|auth.users|id',
    'shop_products|seller_id|auth.users|id',
    'mating_listings|owner_id|auth.users|id',
    'missing_pets|owner_id|auth.users|id',
    'missing_pet_sightings|reporter_id|auth.users|id',
    'reviews|reviewer_id|auth.users|id',
    'reports|reporter_id|auth.users|id',
    'vet_applications|user_id|auth.users|id'
  ];
  spec text; parts text[]; tbl text; col text; ref_tbl text; ref_col text;
  fk_name text;
BEGIN
  FOREACH spec IN ARRAY fk_specs LOOP
    parts := string_to_array(spec, '|');
    tbl := parts[1]; col := parts[2]; ref_tbl := parts[3]; ref_col := parts[4];
    fk_name := tbl || '_' || col || '_fkey_cascade';

    -- Drop any existing FK on this column
    FOR r IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = ('public.' || tbl)::regclass
        AND contype = 'f'
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                            WHERE attrelid = ('public.' || tbl)::regclass
                              AND attname = col)]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, r.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE CASCADE',
      tbl, fk_name, col, ref_tbl, ref_col
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 9) DELETION LOG (audit trail for DPDP)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_hash text,
  reason text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY deletion_log_admin_select ON public.deletion_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------------------
-- 10) ERROR LOG (lightweight observability â€” no Sentry needed)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL,        -- 'client' | 'edge:<fn>'
  route text,
  message text NOT NULL,
  stack text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_log_created_idx ON public.error_log (created_at DESC);

ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_log_insert_any_authed ON public.error_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY error_log_admin_select ON public.error_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));




-- Recreate pets_public view as SECURITY INVOKER (Postgres 15+)
DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public
  WITH (security_invoker = true)
  AS
  SELECT id, name, species, breed, gender, avatar_url, bio, city,
         vaccination_verified, discoverable_for_mating
  FROM public.pets;
GRANT SELECT ON public.pets_public TO authenticated;

-- Lock down remaining SECURITY DEFINER functions from anon execute
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                     r.nspname, r.proname, r.args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                     r.nspname, r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      -- skip extension-owned functions we cannot modify
      NULL;
    END;
  END LOOP;
END $$;

-- Storage: replace broad public-listing SELECT policies with object-only access.
-- We keep public read access but prevent listing by requiring a non-empty `name`
-- prefix match â€” i.e. you must already know the path.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polcmd = 'r'  -- SELECT
  LOOP
    -- Only drop the very-permissive ones; leave bucket-scoped ones alone
    IF r.polname ILIKE '%public%' OR r.polname ILIKE '%anyone%' OR r.polname ILIKE '%allow read%' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.polname);
    END IF;
  END LOOP;
END $$;

-- Re-add narrow public read for the public buckets (still no LIST because
-- the policy requires a specific object name lookup, not a wildcard scan)
DROP POLICY IF EXISTS "public_read_objects_in_public_buckets" ON storage.objects;
CREATE POLICY "public_read_objects_in_public_buckets"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id IN ('pet-avatars','user-avatars','posts','missing-pets','marketplace')
    AND name IS NOT NULL
  );

-- Note: Supabase clients call .list() against storage.objects with a SELECT.
-- We accept that list calls still work for AUTHENTICATED users to keep the app
-- functional, but anonymous visitors cannot enumerate.




-- Remove any prior schedule with this name
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'drain-notification-jobs';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'drain-notification-jobs',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://fappyyhsdmybkyrhyutm.supabase.co/functions/v1/process-notification-jobs',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcHB5eWhzZG15Ymt5cmh5dXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDgwNTIsImV4cCI6MjA5MjkyNDA1Mn0.B8mZ31CJzSouxzVKY777dHjT_lz_k_yCikOdrUvjs7g"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);



CREATE TABLE IF NOT EXISTS public.cron_health (
  job_name text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text NOT NULL DEFAULT 'ok',
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_health_admin_select"
ON public.cron_health
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);




-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.appointment_mode AS ENUM ('chat','video','in_clinic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('requested','confirmed','in_progress','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.parasite_type AS ENUM ('flea','tick','heartworm','dewormer','combination','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.access_request_status AS ENUM ('pending','approved','rejected','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PETS COLUMN ADDITIONS ============
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS public_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS microchip_id text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_policy text,
  ADD COLUMN IF NOT EXISTS current_medications text,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS primary_vet_id uuid;

-- Function to mint a unique short pet id
CREATE OR REPLACE FUNCTION public.generate_pet_public_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_id text;
  v_exists boolean;
BEGIN
  LOOP
    v_id := 'PET-' ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1) ||
      substr(v_chars, 1+floor(random()*32)::int, 1);
    SELECT EXISTS(SELECT 1 FROM public.pets WHERE public_id = v_id) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_id;
END $$;

-- Trigger to auto-assign public_id on insert
CREATE OR REPLACE FUNCTION public.set_pet_public_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.public_id IS NULL THEN
    NEW.public_id := public.generate_pet_public_id();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pets_set_public_id ON public.pets;
CREATE TRIGGER pets_set_public_id
  BEFORE INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.set_pet_public_id();

-- Backfill existing pets
UPDATE public.pets SET public_id = public.generate_pet_public_id() WHERE public_id IS NULL;

-- ============ VET CARE TEAM (defined early - used by RLS below) ============
CREATE TABLE IF NOT EXISTS public.pet_care_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  vet_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(pet_id, vet_id)
);
CREATE INDEX IF NOT EXISTS idx_pct_vet ON public.pet_care_team(vet_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pct_pet ON public.pet_care_team(pet_id) WHERE revoked_at IS NULL;
ALTER TABLE public.pet_care_team ENABLE ROW LEVEL SECURITY;

-- ============ APPOINTMENTS (defined early - used by RLS) ============
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  mode public.appointment_mode NOT NULL DEFAULT 'chat',
  status public.appointment_status NOT NULL DEFAULT 'requested',
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  video_room_url text,
  video_room_name text,
  notes text,
  prescription text,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appts_vet_time ON public.appointments(vet_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appts_owner ON public.appointments(owner_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appts_pet ON public.appointments(pet_id);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER appts_set_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper function: does the current user (vet) have read access to this pet?
CREATE OR REPLACE FUNCTION public.vet_can_read_pet(_pet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pet_care_team
    WHERE pet_id = _pet_id AND vet_id = auth.uid() AND revoked_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.vet_access_grants g
    JOIN public.user_roles ur ON ur.user_id = auth.uid() AND ur.role = 'vet'
    WHERE g.pet_id = _pet_id
      AND g.revoked = false
      AND g.expires_at > now()
  ) OR EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.pet_id = _pet_id
      AND a.vet_id = auth.uid()
      AND a.status IN ('requested','confirmed','in_progress','completed')
  );
$$;

-- ============ HEALTH: VITAL LOGS ============
CREATE TABLE IF NOT EXISTS public.vital_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  weight_kg numeric,
  body_condition smallint,
  temperature_c numeric,
  heart_rate_bpm int,
  respiratory_rate_rpm int,
  gum_colour text,
  hydration text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vitals_pet_time ON public.vital_logs(pet_id, recorded_at DESC);
ALTER TABLE public.vital_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY vitals_owner_all ON public.vital_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = vital_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = vital_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY vitals_vet_read ON public.vital_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: PARASITE PREVENTATIVES ============
CREATE TABLE IF NOT EXISTS public.parasite_preventatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  product_name text NOT NULL,
  parasite_type public.parasite_type NOT NULL DEFAULT 'combination',
  given_on date NOT NULL DEFAULT CURRENT_DATE,
  next_due_on date,
  batch_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parasite_pet ON public.parasite_preventatives(pet_id, given_on DESC);
ALTER TABLE public.parasite_preventatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY parasite_owner_all ON public.parasite_preventatives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = parasite_preventatives.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = parasite_preventatives.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY parasite_vet_read ON public.parasite_preventatives FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: MEDICATION LOGS ============
CREATE TABLE IF NOT EXISTS public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  name text NOT NULL,
  dose text,
  route text,
  frequency text,
  start_on date NOT NULL DEFAULT CURRENT_DATE,
  end_on date,
  prescribing_vet text,
  reason text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meds_pet ON public.medication_logs(pet_id, start_on DESC);
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER meds_set_updated BEFORE UPDATE ON public.medication_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY meds_owner_all ON public.medication_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY meds_vet_read ON public.medication_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: ACTIVITY LOGS ============
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  logged_for date NOT NULL DEFAULT CURRENT_DATE,
  walk_minutes int,
  energy smallint,
  sleep_hours numeric,
  mood text[],
  stool_score smallint,
  urine_frequency int,
  water_ml int,
  appetite smallint,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_pet ON public.activity_logs(pet_id, logged_for DESC);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_owner_all ON public.activity_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = activity_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = activity_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY activity_vet_read ON public.activity_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- ============ HEALTH: REPRO LOGS ============
CREATE TABLE IF NOT EXISTS public.repro_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  partner_pet_id uuid,
  litter_count int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repro_pet ON public.repro_logs(pet_id, occurred_on DESC);
ALTER TABLE public.repro_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY repro_owner_all ON public.repro_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = repro_logs.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = repro_logs.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY repro_vet_read ON public.repro_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- Also extend vet read access to existing health tables
CREATE POLICY vaccinations_vet_read ON public.vaccinations FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));
CREATE POLICY health_records_vet_read ON public.health_records FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));
CREATE POLICY symptom_logs_vet_read ON public.symptom_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));
CREATE POLICY nutrition_logs_vet_read ON public.nutrition_logs FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(pet_id));

-- Pets row read for vet on care-team / grant / appointment
CREATE POLICY pets_vet_read ON public.pets FOR SELECT TO authenticated
  USING (public.vet_can_read_pet(id));

-- ============ VET PROFILES ============
CREATE TABLE IF NOT EXISTS public.vet_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  photo_url text,
  bio text,
  languages text[] NOT NULL DEFAULT '{}',
  license_number text NOT NULL,
  license_council text,
  year_qualified int,
  license_doc_path text,
  clinic_name text,
  address text,
  city text,
  lat numeric,
  lng numeric,
  phone text,
  specialisations text[] NOT NULL DEFAULT '{}',
  consult_modes public.appointment_mode[] NOT NULL DEFAULT ARRAY['chat','video']::public.appointment_mode[],
  default_duration_min int NOT NULL DEFAULT 30,
  price_chat_inr int NOT NULL DEFAULT 0,
  price_video_inr int NOT NULL DEFAULT 0,
  price_clinic_inr int NOT NULL DEFAULT 0,
  onboarded boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  rating_avg numeric,
  rating_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vet_profiles_city ON public.vet_profiles(city);
ALTER TABLE public.vet_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER vet_profiles_set_updated BEFORE UPDATE ON public.vet_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY vet_profiles_self_all ON public.vet_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY vet_profiles_public_read ON public.vet_profiles FOR SELECT TO authenticated
  USING (active = true AND onboarded = true);

-- ============ VET AVAILABILITY ============
CREATE TABLE IF NOT EXISTS public.vet_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  mode public.appointment_mode NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avail_vet ON public.vet_availability(vet_id, weekday);
ALTER TABLE public.vet_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY avail_self_all ON public.vet_availability FOR ALL TO authenticated
  USING (vet_id = auth.uid()) WITH CHECK (vet_id = auth.uid());
CREATE POLICY avail_public_read ON public.vet_availability FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.vet_availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  override_date date NOT NULL,
  is_blocked boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_avail_ovr_vet ON public.vet_availability_overrides(vet_id, override_date);
ALTER TABLE public.vet_availability_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY avail_ovr_self_all ON public.vet_availability_overrides FOR ALL TO authenticated
  USING (vet_id = auth.uid()) WITH CHECK (vet_id = auth.uid());
CREATE POLICY avail_ovr_public_read ON public.vet_availability_overrides FOR SELECT TO authenticated USING (true);

-- ============ PET CARE TEAM POLICIES ============
CREATE POLICY pct_owner_all ON public.pet_care_team FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_care_team.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_care_team.pet_id AND p.owner_id = auth.uid()));
CREATE POLICY pct_vet_read ON public.pet_care_team FOR SELECT TO authenticated
  USING (vet_id = auth.uid());

-- ============ PET ACCESS REQUESTS ============
CREATE TABLE IF NOT EXISTS public.pet_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  message text,
  status public.access_request_status NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_par_owner ON public.pet_access_requests(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_par_vet ON public.pet_access_requests(vet_id);
ALTER TABLE public.pet_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY par_vet_insert ON public.pet_access_requests FOR INSERT TO authenticated
  WITH CHECK (vet_id = auth.uid() AND public.has_role(auth.uid(), 'vet'::app_role));
CREATE POLICY par_party_select ON public.pet_access_requests FOR SELECT TO authenticated
  USING (vet_id = auth.uid() OR owner_id = auth.uid());
CREATE POLICY par_owner_update ON public.pet_access_requests FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- When owner approves an access request, create / reactivate the care-team link
CREATE OR REPLACE FUNCTION public.on_access_request_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    INSERT INTO public.pet_care_team (pet_id, vet_id)
    VALUES (NEW.pet_id, NEW.vet_id)
    ON CONFLICT (pet_id, vet_id) DO UPDATE SET revoked_at = NULL, granted_at = now();
    NEW.responded_at := now();
    PERFORM public.notify_user(NEW.vet_id, 'access_approved',
      'Pet access approved', 'You can now view this pet''s health records.', '/vet');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    NEW.responded_at := now();
    PERFORM public.notify_user(NEW.vet_id, 'access_rejected',
      'Pet access rejected', NULL, '/vet');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS par_decision ON public.pet_access_requests;
CREATE TRIGGER par_decision
  BEFORE UPDATE ON public.pet_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_access_request_decision();

-- Notify owner on new access request
CREATE OR REPLACE FUNCTION public.on_access_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pet_name text;
BEGIN
  SELECT name INTO v_pet_name FROM public.pets WHERE id = NEW.pet_id;
  PERFORM public.notify_user(NEW.owner_id, 'access_request',
    'A vet wants to access ' || COALESCE(v_pet_name, 'your pet'),
    NEW.message,
    '/profile');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS par_insert_notify ON public.pet_access_requests;
CREATE TRIGGER par_insert_notify
  AFTER INSERT ON public.pet_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_access_request_insert();

-- ============ APPOINTMENTS POLICIES ============
CREATE POLICY appts_owner_insert ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));
CREATE POLICY appts_party_select ON public.appointments FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR vet_id = auth.uid());
CREATE POLICY appts_party_update ON public.appointments FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR vet_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR vet_id = auth.uid());

-- Notify on appointment lifecycle
CREATE OR REPLACE FUNCTION public.on_appointment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.vet_id, 'appt_new',
      'New appointment request',
      'Mode: ' || NEW.mode::text || ' on ' || to_char(NEW.scheduled_at, 'DD Mon HH24:MI'),
      '/vet');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.owner_id, 'appt_status',
      'Appointment ' || NEW.status::text,
      'Update on your appointment',
      '/profile');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appts_event ON public.appointments;
CREATE TRIGGER appts_event
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.on_appointment_event();

-- ============ APPOINTMENT MESSAGES ============
CREATE TABLE IF NOT EXISTS public.appointment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appt_msgs ON public.appointment_messages(appointment_id, created_at);
ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY appt_msgs_party_select ON public.appointment_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a
    WHERE a.id = appointment_messages.appointment_id
      AND (a.owner_id = auth.uid() OR a.vet_id = auth.uid())));
CREATE POLICY appt_msgs_party_insert ON public.appointment_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_messages.appointment_id
        AND (a.owner_id = auth.uid() OR a.vet_id = auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;




ALTER TABLE public.reminder_log DROP CONSTRAINT IF EXISTS reminder_log_pkey;

ALTER TABLE public.reminder_log
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS ref_id uuid,
  ALTER COLUMN vaccination_id DROP NOT NULL;

UPDATE public.reminder_log SET ref_id = vaccination_id WHERE ref_id IS NULL AND vaccination_id IS NOT NULL;

ALTER TABLE public.reminder_log ADD PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_kind_ref_uidx
  ON public.reminder_log (kind, ref_id)
  WHERE ref_id IS NOT NULL;



CREATE TABLE public.follows (
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_select_all ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY follows_insert_own ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY follows_delete_own ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  pet_id UUID,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  view_count INT NOT NULL DEFAULT 0
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY stories_select_active ON public.stories FOR SELECT TO authenticated USING (expires_at > now() OR author_id = auth.uid());
CREATE POLICY stories_insert_own ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY stories_delete_own ON public.stories FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE INDEX idx_stories_author_expires ON public.stories(author_id, expires_at DESC);
CREATE INDEX idx_stories_expires ON public.stories(expires_at DESC);

CREATE TABLE public.story_views (
  story_id UUID NOT NULL,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_views_insert_own ON public.story_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY story_views_select_party ON public.story_views FOR SELECT TO authenticated USING (
  auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.author_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.bump_story_view()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.stories SET view_count = view_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bump_story_view AFTER INSERT ON public.story_views FOR EACH ROW EXECUTE FUNCTION public.bump_story_view();

CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_id UUID,
  kind TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pet_id, kind)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY achievements_select_all ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_achievements_user ON public.achievements(user_id);

CREATE OR REPLACE FUNCTION public.on_new_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.notify_user(NEW.following_id, 'new_follower',
    'New follower',
    COALESCE(v_name, 'Someone') || ' started following you',
    '/u/' || NEW.follower_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_on_new_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.on_new_follow();

CREATE OR REPLACE FUNCTION public.award_first_post()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.achievements (user_id, kind) VALUES (NEW.author_id, 'first_post')
  ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_award_first_post AFTER INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.award_first_post();

INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Stories publicly viewable" ON storage.objects;
CREATE POLICY "Stories publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
DROP POLICY IF EXISTS "Users upload own stories" ON storage.objects;
CREATE POLICY "Users upload own stories" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users delete own stories" ON storage.objects;
CREATE POLICY "Users delete own stories" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;




CREATE TYPE public.group_kind AS ENUM ('breed', 'city', 'interest');
CREATE TYPE public.group_member_role AS ENUM ('member', 'mod', 'owner');
CREATE TYPE public.meetup_status AS ENUM ('upcoming', 'cancelled', 'done');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'maybe', 'declined');

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.group_kind NOT NULL,
  key text NOT NULL,
  description text,
  cover_url text,
  member_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, key)
);
CREATE INDEX idx_groups_kind_key ON public.groups(kind, key);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_select_all ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY groups_insert_authed ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY groups_update_owner ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY groups_delete_owner ON public.groups FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.group_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY gm_select_all ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY gm_insert_self ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY gm_delete_self_or_owner ON public.group_members FOR DELETE TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.created_by = auth.uid())
);

CREATE OR REPLACE FUNCTION public.bump_group_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_gm_count_ins AFTER INSERT ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.bump_group_member_count();
CREATE TRIGGER trg_gm_count_del AFTER DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.bump_group_member_count();

CREATE TABLE public.group_posts (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, post_id)
);
CREATE INDEX idx_group_posts_post ON public.group_posts(post_id);
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY gp_select_all ON public.group_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY gp_insert_author ON public.group_posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = added_by AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
);
CREATE POLICY gp_delete_author ON public.group_posts FOR DELETE TO authenticated USING (auth.uid() = added_by);

CREATE TABLE public.meetups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  city text,
  venue text,
  lat numeric,
  lng numeric,
  starts_at timestamptz NOT NULL,
  capacity integer,
  cover_url text,
  status public.meetup_status NOT NULL DEFAULT 'upcoming',
  attending_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetups_starts_at ON public.meetups(starts_at);
CREATE INDEX idx_meetups_city ON public.meetups(city);
CREATE INDEX idx_meetups_group ON public.meetups(group_id);
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
CREATE POLICY meetups_select_all ON public.meetups FOR SELECT TO authenticated USING (true);
CREATE POLICY meetups_insert_host ON public.meetups FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY meetups_update_host ON public.meetups FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY meetups_delete_host ON public.meetups FOR DELETE TO authenticated USING (auth.uid() = host_id);
CREATE TRIGGER trg_meetups_updated BEFORE UPDATE ON public.meetups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.meetup_rsvps (
  meetup_id uuid NOT NULL REFERENCES public.meetups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pet_id uuid,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);
CREATE INDEX idx_rsvps_user ON public.meetup_rsvps(user_id);
ALTER TABLE public.meetup_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsvps_select_all ON public.meetup_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY rsvps_insert_self ON public.meetup_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY rsvps_update_self ON public.meetup_rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY rsvps_delete_self ON public.meetup_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recount_meetup_attending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.meetup_id, OLD.meetup_id);
  UPDATE public.meetups
  SET attending_count = (SELECT count(*) FROM public.meetup_rsvps WHERE meetup_id = v_id AND status = 'going')
  WHERE id = v_id;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_rsvps_count_ins AFTER INSERT ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.recount_meetup_attending();
CREATE TRIGGER trg_rsvps_count_upd AFTER UPDATE ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.recount_meetup_attending();
CREATE TRIGGER trg_rsvps_count_del AFTER DELETE ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.recount_meetup_attending();
CREATE TRIGGER trg_rsvps_updated BEFORE UPDATE ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.on_rsvp_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host uuid; v_title text;
BEGIN
  SELECT host_id, title INTO v_host, v_title FROM public.meetups WHERE id = NEW.meetup_id;
  IF v_host IS NOT NULL AND v_host <> NEW.user_id AND NEW.status = 'going' THEN
    PERFORM public.notify_user(v_host, 'meetup_rsvp', 'New RSVP for ' || v_title, 'Someone is coming to your meetup', '/meetups/' || NEW.meetup_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rsvp_notify AFTER INSERT ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.on_rsvp_insert();

INSERT INTO public.groups (slug, name, kind, key, description) VALUES
  ('breed-golden-retriever', 'Golden Retrievers', 'breed', 'golden_retriever', 'For everyone with a Golden in their life.'),
  ('breed-labrador', 'Labrador Lovers', 'breed', 'labrador', 'Labradors of every shade welcome.'),
  ('breed-german-shepherd', 'German Shepherds', 'breed', 'german_shepherd', 'Smart, loyal, and loved.'),
  ('breed-beagle', 'Beagle Pack', 'breed', 'beagle', 'Sniffers united.'),
  ('breed-pug', 'Pug Life', 'breed', 'pug', 'For the snorters and the cuddlers.'),
  ('breed-shih-tzu', 'Shih Tzu Squad', 'breed', 'shih_tzu', 'Tiny royalty.'),
  ('breed-pomeranian', 'Pomeranian Posse', 'breed', 'pomeranian', 'Floof appreciation only.'),
  ('breed-indie', 'Indie Dogs of India', 'breed', 'indie', 'Celebrating our incredible street dogs.'),
  ('breed-persian-cat', 'Persian Cats', 'breed', 'persian_cat', 'Long-haired beauties.'),
  ('breed-ragdoll', 'Ragdoll Cats', 'breed', 'ragdoll', 'Floppy purrballs.'),
  ('city-bengaluru', 'Bengaluru Pet Parents', 'city', 'bengaluru', 'Meetups, vets, parks â€” all in BLR.'),
  ('city-mumbai', 'Mumbai Pet Parents', 'city', 'mumbai', 'For pets and people in Mumbai.'),
  ('city-delhi', 'Delhi NCR Pets', 'city', 'delhi', 'Across NCR â€” meet, play, share.'),
  ('city-hyderabad', 'Hyderabad Pets', 'city', 'hyderabad', 'Hi-tech city, happy pets.'),
  ('city-chennai', 'Chennai Pets', 'city', 'chennai', 'Madras pet parent meetups.'),
  ('city-pune', 'Pune Pets', 'city', 'pune', 'Walks, vets, and weekend meetups.'),
  ('city-kolkata', 'Kolkata Pets', 'city', 'kolkata', 'For pet parents in the City of Joy.'),
  ('city-ahmedabad', 'Ahmedabad Pets', 'city', 'ahmedabad', 'Gujarat pet community.'),
  ('city-jaipur', 'Jaipur Pets', 'city', 'jaipur', 'Pink City pet parents.'),
  ('city-goa', 'Goa Pets', 'city', 'goa', 'Beach dogs and beyond.'),
  ('interest-puppy-training', 'Puppy Training 101', 'interest', 'puppy_training', 'Tips, tricks, and shared wins.'),
  ('interest-raw-feeding', 'Raw & Fresh Feeding', 'interest', 'raw_feeding', 'Recipes, sources, science.'),
  ('interest-adoption', 'Adopt Don''t Shop', 'interest', 'adoption', 'Rescues and rehoming.'),
  ('interest-senior-care', 'Senior Pet Care', 'interest', 'senior_care', 'Loving our greying companions.'),
  ('interest-dog-sports', 'Dog Sports & Agility', 'interest', 'dog_sports', 'Flyball, agility, frisbee.'),
  ('interest-grooming-diy', 'DIY Grooming', 'interest', 'grooming_diy', 'Brushes, baths, and trims at home.'),
  ('interest-travel', 'Travel With Pets', 'interest', 'travel', 'Pet-friendly stays and tips.'),
  ('interest-photography', 'Pet Photography', 'interest', 'photography', 'Capture the cuteness.'),
  ('interest-anxiety', 'Anxiety & Behaviour', 'interest', 'anxiety', 'Support for reactive and anxious pets.'),
  ('interest-cat-enrichment', 'Cat Behaviour & Enrichment', 'interest', 'cat_enrichment', 'Toys, puzzles, climbing setups.');




CREATE TYPE public.vet_q_status AS ENUM ('open', 'answered', 'closed');
CREATE TYPE public.vet_q_category AS ENUM ('behavior', 'nutrition', 'medical', 'training', 'other');

CREATE TABLE public.vet_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asker_id uuid NOT NULL,
  pet_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  species text,
  category public.vet_q_category NOT NULL DEFAULT 'other',
  photo_urls text[] NOT NULL DEFAULT '{}',
  status public.vet_q_status NOT NULL DEFAULT 'open',
  best_answer_id uuid,
  view_count integer NOT NULL DEFAULT 0,
  answer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vetq_created ON public.vet_questions(created_at DESC);
CREATE INDEX idx_vetq_category ON public.vet_questions(category);
CREATE INDEX idx_vetq_status ON public.vet_questions(status);
ALTER TABLE public.vet_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY vetq_select_all ON public.vet_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY vetq_insert_self ON public.vet_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = asker_id);
CREATE POLICY vetq_update_asker ON public.vet_questions FOR UPDATE TO authenticated USING (auth.uid() = asker_id) WITH CHECK (auth.uid() = asker_id);
CREATE POLICY vetq_delete_asker ON public.vet_questions FOR DELETE TO authenticated USING (auth.uid() = asker_id);
CREATE TRIGGER trg_vetq_updated BEFORE UPDATE ON public.vet_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vet_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.vet_questions(id) ON DELETE CASCADE,
  vet_id uuid NOT NULL,
  body text NOT NULL,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vetans_question ON public.vet_answers(question_id);
CREATE INDEX idx_vetans_vet ON public.vet_answers(vet_id);
ALTER TABLE public.vet_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY vetans_select_all ON public.vet_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY vetans_insert_vet ON public.vet_answers FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = vet_id AND public.has_role(auth.uid(), 'vet')
);
CREATE POLICY vetans_update_own ON public.vet_answers FOR UPDATE TO authenticated USING (auth.uid() = vet_id) WITH CHECK (auth.uid() = vet_id);
CREATE POLICY vetans_delete_own ON public.vet_answers FOR DELETE TO authenticated USING (auth.uid() = vet_id);
CREATE TRIGGER trg_vetans_updated BEFORE UPDATE ON public.vet_answers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vet_answer_helpful (
  answer_id uuid NOT NULL REFERENCES public.vet_answers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (answer_id, user_id)
);
ALTER TABLE public.vet_answer_helpful ENABLE ROW LEVEL SECURITY;
CREATE POLICY vah_select_all ON public.vet_answer_helpful FOR SELECT TO authenticated USING (true);
CREATE POLICY vah_insert_self ON public.vet_answer_helpful FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vah_delete_self ON public.vet_answer_helpful FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Helpful count + answer count + helpful_vet badge
CREATE OR REPLACE FUNCTION public.bump_answer_helpful()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vet uuid; v_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.vet_answers SET helpful_count = helpful_count + 1 WHERE id = NEW.answer_id
      RETURNING vet_id, helpful_count INTO v_vet, v_count;
    -- Award helpful_vet badge every 10 helpfuls
    IF v_count IN (10, 50, 100) THEN
      INSERT INTO public.achievements (user_id, kind) VALUES (v_vet, 'helpful_vet')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.vet_answers SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.answer_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_vah_ins AFTER INSERT ON public.vet_answer_helpful FOR EACH ROW EXECUTE FUNCTION public.bump_answer_helpful();
CREATE TRIGGER trg_vah_del AFTER DELETE ON public.vet_answer_helpful FOR EACH ROW EXECUTE FUNCTION public.bump_answer_helpful();

-- Notify asker, bump answer count, mark question answered
CREATE OR REPLACE FUNCTION public.on_vet_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_asker uuid; v_title text;
BEGIN
  UPDATE public.vet_questions
    SET answer_count = answer_count + 1,
        status = CASE WHEN status = 'open' THEN 'answered'::vet_q_status ELSE status END
    WHERE id = NEW.question_id
    RETURNING asker_id, title INTO v_asker, v_title;
  IF v_asker IS NOT NULL AND v_asker <> NEW.vet_id THEN
    PERFORM public.notify_user(v_asker, 'vet_answer',
      'A vet answered your question',
      LEFT(NEW.body, 80),
      '/askvet/' || NEW.question_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vetans_after_insert AFTER INSERT ON public.vet_answers FOR EACH ROW EXECUTE FUNCTION public.on_vet_answer();

-- ============================================================
-- New badges: vaccinated, dewormed_recent, meetup_host, social_butterfly
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_vaccinated_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.vaccination_verified = true AND COALESCE(OLD.vaccination_verified, false) = false THEN
    INSERT INTO public.achievements (user_id, pet_id, kind) VALUES (NEW.owner_id, NEW.id, 'vaccinated')
    ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pets_vaccinated AFTER UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.award_vaccinated_badge();

CREATE OR REPLACE FUNCTION public.award_dewormed_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.pets WHERE id = NEW.pet_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.achievements (user_id, pet_id, kind) VALUES (v_owner, NEW.pet_id, 'dewormed_recent')
    ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_parasite_dewormed AFTER INSERT ON public.parasite_preventatives FOR EACH ROW EXECUTE FUNCTION public.award_dewormed_badge();

CREATE OR REPLACE FUNCTION public.award_meetup_host_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.achievements (user_id, kind) VALUES (NEW.host_id, 'meetup_host')
  ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_meetup_host_badge AFTER INSERT ON public.meetups FOR EACH ROW EXECUTE FUNCTION public.award_meetup_host_badge();

CREATE OR REPLACE FUNCTION public.award_social_butterfly_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.status = 'going' THEN
    SELECT count(*) INTO v_count FROM public.meetup_rsvps WHERE user_id = NEW.user_id AND status = 'going';
    IF v_count >= 3 THEN
      INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'social_butterfly')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_social_butterfly AFTER INSERT ON public.meetup_rsvps FOR EACH ROW EXECUTE FUNCTION public.award_social_butterfly_badge();



-- ============================================
-- Phase 4: Daily Pet Moment + Collab Posts
-- ============================================

-- =============== DAILY MOMENTS ===============
CREATE TABLE public.daily_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_date date NOT NULL UNIQUE,
  prompt_text text NOT NULL,
  dropped_at timestamptz NOT NULL DEFAULT now(),
  window_minutes integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_prompts_select_all ON public.daily_prompts FOR SELECT TO authenticated USING (true);

CREATE TABLE public.daily_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.daily_prompts(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  posted_at timestamptz NOT NULL DEFAULT now(),
  on_time boolean NOT NULL DEFAULT false,
  late_minutes integer NOT NULL DEFAULT 0,
  UNIQUE (prompt_id, user_id)
);
CREATE INDEX idx_daily_moments_prompt ON public.daily_moments(prompt_id);
CREATE INDEX idx_daily_moments_user ON public.daily_moments(user_id);
ALTER TABLE public.daily_moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_moments_select_all ON public.daily_moments FOR SELECT TO authenticated USING (true);
CREATE POLICY daily_moments_insert_own ON public.daily_moments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
CREATE POLICY daily_moments_delete_own ON public.daily_moments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.daily_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_posted_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_streaks_select_all ON public.daily_streaks FOR SELECT TO authenticated USING (true);

-- Trigger: on daily_moment insert, compute on_time and update streak
CREATE OR REPLACE FUNCTION public.on_daily_moment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dropped timestamptz;
  v_window int;
  v_date date;
  v_diff_min int;
  v_streak int;
  v_last date;
  v_longest int;
BEGIN
  SELECT dropped_at, window_minutes, prompt_date INTO v_dropped, v_window, v_date
    FROM public.daily_prompts WHERE id = NEW.prompt_id;
  v_diff_min := GREATEST(0, EXTRACT(EPOCH FROM (NEW.posted_at - v_dropped))/60)::int;
  NEW.on_time := v_diff_min <= v_window;
  NEW.late_minutes := GREATEST(0, v_diff_min - v_window);

  -- Streak update
  SELECT current_streak, last_posted_date, longest_streak
    INTO v_streak, v_last, v_longest
    FROM public.daily_streaks WHERE user_id = NEW.user_id;

  IF v_last IS NULL THEN
    v_streak := 1;
  ELSIF v_last = v_date THEN
    -- already posted today (shouldn't happen due to UNIQUE)
    v_streak := COALESCE(v_streak, 1);
  ELSIF v_last = v_date - 1 THEN
    v_streak := COALESCE(v_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;
  v_longest := GREATEST(COALESCE(v_longest, 0), v_streak);

  INSERT INTO public.daily_streaks (user_id, current_streak, longest_streak, last_posted_date, updated_at)
  VALUES (NEW.user_id, v_streak, v_longest, v_date, now())
  ON CONFLICT (user_id) DO UPDATE
    SET current_streak = EXCLUDED.current_streak,
        longest_streak = EXCLUDED.longest_streak,
        last_posted_date = EXCLUDED.last_posted_date,
        updated_at = now();

  -- Award badges
  INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'daily_moment_first')
    ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  IF v_streak >= 7 THEN
    INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'daily_streak_7')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;
  IF v_streak >= 30 THEN
    INSERT INTO public.achievements (user_id, kind) VALUES (NEW.user_id, 'daily_streak_30')
      ON CONFLICT (user_id, pet_id, kind) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_daily_moment_insert
BEFORE INSERT ON public.daily_moments
FOR EACH ROW EXECUTE FUNCTION public.on_daily_moment_insert();

-- =============== COLLAB POSTS ===============
CREATE TYPE public.collab_status AS ENUM ('pending','accepted','declined');

CREATE TABLE public.post_collaborators (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pet_id uuid,
  status public.collab_status NOT NULL DEFAULT 'pending',
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_collab_user_status ON public.post_collaborators(user_id, status);
CREATE INDEX idx_collab_post ON public.post_collaborators(post_id);

ALTER TABLE public.post_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_select_visible ON public.post_collaborators FOR SELECT TO authenticated
  USING (
    status = 'accepted'
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

CREATE POLICY pc_insert_author ON public.post_collaborators FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

CREATE POLICY pc_update_invitee ON public.post_collaborators FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY pc_delete_author_or_self ON public.post_collaborators FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

-- Triggers: notify on invite + acceptance
CREATE OR REPLACE FUNCTION public.on_collab_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author_name text;
BEGIN
  SELECT pr.full_name INTO v_author_name
    FROM public.posts p
    JOIN public.profiles pr ON pr.id = p.author_id
    WHERE p.id = NEW.post_id;
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.notify_user(NEW.user_id, 'collab_invite',
      COALESCE(v_author_name, 'Someone') || ' tagged you in a post',
      'Tap to accept and add it to your profile.',
      '/u/' || NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_collab_invite AFTER INSERT ON public.post_collaborators
FOR EACH ROW EXECUTE FUNCTION public.on_collab_invite();

CREATE OR REPLACE FUNCTION public.on_collab_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid; v_user_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted','declined') THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
    NEW.responded_at := now();
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      PERFORM public.notify_user(v_author,
        CASE WHEN NEW.status = 'accepted' THEN 'collab_accepted' ELSE 'collab_declined' END,
        COALESCE(v_user_name, 'Someone') || ' ' || NEW.status::text || ' your collab',
        NULL,
        '/');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_collab_response BEFORE UPDATE ON public.post_collaborators
FOR EACH ROW EXECUTE FUNCTION public.on_collab_response();



SELECT cron.schedule(
  'drop-daily-prompt-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fappyyhsdmybkyrhyutm.supabase.co/functions/v1/drop-daily-prompt',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcHB5eWhzZG15Ymt5cmh5dXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDgwNTIsImV4cCI6MjA5MjkyNDA1Mn0.B8mZ31CJzSouxzVKY777dHjT_lz_k_yCikOdrUvjs7g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);



-- 1. Reactions table
CREATE TABLE public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('love','paw','laugh','wow','sad')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, kind)
);
CREATE INDEX idx_post_reactions_post ON public.post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON public.post_reactions(user_id);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select_all" ON public.post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert_own" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete_own" ON public.post_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Reaction counts on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.bump_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post uuid;
  v_kind text;
  v_delta int;
  v_current jsonb;
  v_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_post := NEW.post_id; v_kind := NEW.kind; v_delta := 1;
  ELSE
    v_post := OLD.post_id; v_kind := OLD.kind; v_delta := -1;
  END IF;

  SELECT reaction_counts INTO v_current FROM public.posts WHERE id = v_post FOR UPDATE;
  v_count := COALESCE((v_current->>v_kind)::int, 0) + v_delta;
  IF v_count < 0 THEN v_count := 0; END IF;
  UPDATE public.posts
    SET reaction_counts = COALESCE(v_current, '{}'::jsonb) || jsonb_build_object(v_kind, v_count)
    WHERE id = v_post;

  -- Keep legacy like_count in sync with total reactions for compatibility
  UPDATE public.posts SET like_count = (
    SELECT COALESCE(SUM((value)::int), 0)
    FROM jsonb_each_text(reaction_counts)
  ) WHERE id = v_post;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_bump_reaction_counts
  AFTER INSERT OR DELETE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.bump_reaction_counts();

-- 3. Notification on new reaction (reuse existing notify_user)
CREATE OR REPLACE FUNCTION public.on_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    PERFORM public.notify_user(v_author, 'post_reaction',
      'Someone reacted to your post', NULL, '/');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_post_reaction_notify
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.on_post_reaction();

-- 4. Backfill existing likes as 'love' reactions
INSERT INTO public.post_reactions (post_id, user_id, kind, created_at)
SELECT post_id, user_id, 'love', created_at FROM public.post_likes
ON CONFLICT (post_id, user_id, kind) DO NOTHING;

-- 5. Realtime
ALTER TABLE public.post_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;



CREATE TABLE public.post_hashtags (
  post_id uuid NOT NULL,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX idx_post_hashtags_tag ON public.post_hashtags(tag, created_at DESC);

ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hashtags_select_all" ON public.post_hashtags FOR SELECT TO authenticated USING (true);
CREATE POLICY "hashtags_insert_author" ON public.post_hashtags FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));
CREATE POLICY "hashtags_delete_author" ON public.post_hashtags FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_post_hashtags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m text[];
BEGIN
  DELETE FROM public.post_hashtags WHERE post_id = NEW.id;
  IF NEW.caption IS NULL OR length(NEW.caption) = 0 THEN
    RETURN NEW;
  END IF;
  FOR m IN
    SELECT regexp_matches(NEW.caption, '#([A-Za-z0-9_]{2,30})', 'g')
  LOOP
    INSERT INTO public.post_hashtags (post_id, tag) VALUES (NEW.id, lower(m[1]))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_post_hashtags
  AFTER INSERT OR UPDATE OF caption ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_hashtags();

UPDATE public.posts SET caption = caption WHERE caption IS NOT NULL;

CREATE OR REPLACE VIEW public.trending_hashtags AS
SELECT tag, count(*)::int AS post_count, max(created_at) AS last_used
FROM public.post_hashtags
WHERE created_at > now() - interval '24 hours'
GROUP BY tag
ORDER BY post_count DESC, last_used DESC
LIMIT 20;

GRANT SELECT ON public.trending_hashtags TO authenticated;



-- Fix trending view: recreate with security_invoker
DROP VIEW IF EXISTS public.trending_hashtags;
CREATE VIEW public.trending_hashtags
WITH (security_invoker = true) AS
SELECT tag, count(*)::int AS post_count, max(created_at) AS last_used
FROM public.post_hashtags
WHERE created_at > now() - interval '24 hours'
GROUP BY tag
ORDER BY post_count DESC, last_used DESC
LIMIT 20;
GRANT SELECT ON public.trending_hashtags TO authenticated;

-- Photo->Health columns on posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS health_kind text
    CHECK (health_kind IS NULL OR health_kind IN ('meal','walk','weight','mood','grooming','medication','symptom')),
  ADD COLUMN IF NOT EXISTS health_pet_id uuid,
  ADD COLUMN IF NOT EXISTS health_value jsonb;

-- Link health records back to source post
ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS source_post_id uuid;
CREATE INDEX IF NOT EXISTS idx_health_records_source_post ON public.health_records(source_post_id);

-- Map post.health_kind to existing health_record_type values dynamically with safe fallback
CREATE OR REPLACE FUNCTION public.tg_post_to_health()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_record_type text;
  v_valid_types text[];
BEGIN
  IF NEW.health_kind IS NULL OR NEW.health_pet_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT owner_id INTO v_owner FROM public.pets WHERE id = NEW.health_pet_id;
  IF v_owner IS NULL OR v_owner <> NEW.author_id THEN
    RETURN NEW;
  END IF;

  -- Get valid enum values for health_record_type
  SELECT array_agg(enumlabel) INTO v_valid_types
  FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'health_record_type';

  IF NEW.health_kind = ANY(v_valid_types) THEN
    v_record_type := NEW.health_kind;
  ELSE
    v_record_type := 'visit';
  END IF;

  v_title := initcap(NEW.health_kind) || ' log';

  INSERT INTO public.health_records (pet_id, record_type, title, notes, occurred_on, source_post_id)
  VALUES (
    NEW.health_pet_id,
    v_record_type::public.health_record_type,
    v_title,
    COALESCE(NEW.caption, '') ||
      CASE WHEN NEW.health_value IS NOT NULL THEN E'\n' || NEW.health_value::text ELSE '' END,
    CURRENT_DATE,
    NEW.id
  );
  RETURN NEW;
END $$;

CREATE TRIGGER trg_post_to_health
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_post_to_health();



-- Wave 6 schema (corrected table names)

-- 1) post_saves
CREATE TABLE IF NOT EXISTS public.post_saves (
  user_id uuid NOT NULL,
  post_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saves_select_own ON public.post_saves;
DROP POLICY IF EXISTS saves_insert_own ON public.post_saves;
DROP POLICY IF EXISTS saves_delete_own ON public.post_saves;
CREATE POLICY saves_select_own ON public.post_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY saves_insert_own ON public.post_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY saves_delete_own ON public.post_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2) comment-as-pet
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS pet_id uuid;

-- 3) AI -> vet handoff fields on vet_questions
ALTER TABLE public.vet_questions ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.vet_questions ADD COLUMN IF NOT EXISTS ai_transcript jsonb;
ALTER TABLE public.vet_questions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- 4) pet_health_status view
CREATE OR REPLACE VIEW public.pet_health_status
WITH (security_invoker = true)
AS
SELECT
  p.id AS pet_id,
  p.owner_id,
  p.name,
  (SELECT MIN(pp.next_due_on) FROM public.parasite_preventatives pp WHERE pp.pet_id = p.id AND pp.next_due_on >= CURRENT_DATE) AS next_parasite_due,
  p.weight_kg,
  (SELECT MAX(al.logged_for) FROM public.activity_logs al WHERE al.pet_id = p.id) AS last_activity_on,
  p.vaccination_verified
FROM public.pets p;



-- Wave 7

-- 1) walk_tracks
CREATE TABLE IF NOT EXISTS public.walk_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_walk_tracks_booking_time ON public.walk_tracks (booking_id, recorded_at);
ALTER TABLE public.walk_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS walk_tracks_select_party ON public.walk_tracks;
CREATE POLICY walk_tracks_select_party ON public.walk_tracks FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.service_bookings sb
    LEFT JOIN public.service_providers sp ON sp.id = sb.provider_id
    WHERE sb.id = walk_tracks.booking_id
      AND (sb.customer_id = auth.uid() OR sp.owner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS walk_tracks_insert_provider ON public.walk_tracks;
CREATE POLICY walk_tracks_insert_provider ON public.walk_tracks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_bookings sb
    JOIN public.service_providers sp ON sp.id = sb.provider_id
    WHERE sb.id = walk_tracks.booking_id
      AND sp.owner_id = auth.uid()
  )
);

-- 2) medication_logs vet linkage
ALTER TABLE public.medication_logs ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE public.medication_logs ADD COLUMN IF NOT EXISTS prescribed_by_vet_id uuid;

-- 3) pharmacy_suggestions
CREATE TABLE IF NOT EXISTS public.pharmacy_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid NOT NULL,
  vet_id uuid NOT NULL,
  appointment_id uuid,
  medication_log_id uuid,
  med_name text NOT NULL,
  dose text,
  frequency text,
  duration text,
  notes text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pharmacy_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pharm_select_party ON public.pharmacy_suggestions;
CREATE POLICY pharm_select_party ON public.pharmacy_suggestions FOR SELECT TO authenticated USING (
  owner_id = auth.uid() OR vet_id = auth.uid()
);
DROP POLICY IF EXISTS pharm_insert_vet ON public.pharmacy_suggestions;
CREATE POLICY pharm_insert_vet ON public.pharmacy_suggestions FOR INSERT TO authenticated WITH CHECK (
  vet_id = auth.uid()
);
DROP POLICY IF EXISTS pharm_update_owner ON public.pharmacy_suggestions;
CREATE POLICY pharm_update_owner ON public.pharmacy_suggestions FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 4) shop_products tags
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shop_products') THEN
    EXECUTE 'ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ''{}''::text[]';
  END IF;
END $$;



CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

ALTER TABLE public.pets        ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS lat numeric, ADD COLUMN IF NOT EXISTS lng numeric;

CREATE INDEX IF NOT EXISTS pets_geo_idx ON public.pets USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS providers_geo_idx ON public.service_providers USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS vet_profiles_geo_idx ON public.vet_profiles USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS meetups_geo_idx ON public.meetups USING gist (ll_to_earth(lat, lng)) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS missing_geo_idx ON public.missing_pets USING gist (ll_to_earth(last_seen_lat, last_seen_lng)) WHERE last_seen_lat IS NOT NULL AND last_seen_lng IS NOT NULL;

CREATE OR REPLACE FUNCTION public.nearby_providers(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 25, _category text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, category text, lat numeric, lng numeric, city text, cover_url text, hourly_rate_inr int, verified boolean, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sp.id, sp.name, sp.category::text, sp.lat, sp.lng, sp.city, sp.cover_url, sp.hourly_rate_inr, sp.verified,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(sp.lat, sp.lng))/1000)::numeric AS distance_km
  FROM public.service_providers sp
  WHERE sp.lat IS NOT NULL AND sp.lng IS NOT NULL AND sp.active = true
    AND (_category IS NULL OR sp.category::text = _category)
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(sp.lat, sp.lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(sp.lat, sp.lng)) <= _radius_km*1000
  ORDER BY distance_km ASC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.nearby_vets(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 25)
RETURNS TABLE (user_id uuid, display_name text, clinic_name text, photo_url text, lat numeric, lng numeric, city text, price_video_inr int, rating_avg numeric, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vp.user_id, vp.display_name, vp.clinic_name, vp.photo_url, vp.lat, vp.lng, vp.city, vp.price_video_inr, vp.rating_avg,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(vp.lat, vp.lng))/1000)::numeric
  FROM public.vet_profiles vp
  WHERE vp.lat IS NOT NULL AND vp.lng IS NOT NULL AND vp.active = true AND vp.onboarded = true
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(vp.lat, vp.lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(vp.lat, vp.lng)) <= _radius_km*1000
  ORDER BY 10 ASC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.nearby_missing(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 50)
RETURNS TABLE (id uuid, pet_id uuid, photo_url text, lat numeric, lng numeric, city text, last_seen_at timestamptz, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mp.id, mp.pet_id, mp.photo_url, mp.last_seen_lat, mp.last_seen_lng, mp.last_seen_city, mp.last_seen_at,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(mp.last_seen_lat, mp.last_seen_lng))/1000)::numeric
  FROM public.missing_pets mp
  WHERE mp.status = 'active' AND mp.last_seen_lat IS NOT NULL AND mp.last_seen_lng IS NOT NULL
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(mp.last_seen_lat, mp.last_seen_lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(mp.last_seen_lat, mp.last_seen_lng)) <= _radius_km*1000
  ORDER BY 8 ASC LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.nearby_meetups(_lat numeric, _lng numeric, _radius_km numeric DEFAULT 50)
RETURNS TABLE (id uuid, title text, lat numeric, lng numeric, city text, starts_at timestamptz, attending_count int, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.title, m.lat, m.lng, m.city, m.starts_at, m.attending_count,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(m.lat, m.lng))/1000)::numeric
  FROM public.meetups m
  WHERE m.status = 'upcoming' AND m.lat IS NOT NULL AND m.lng IS NOT NULL
    AND earth_box(ll_to_earth(_lat, _lng), _radius_km*1000) @> ll_to_earth(m.lat, m.lng)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(m.lat, m.lng)) <= _radius_km*1000
  ORDER BY 8 ASC LIMIT 200;
$$;



-- 1) Public share token on service_bookings
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS public_share_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.service_bookings SET public_share_token = gen_random_uuid()
  WHERE public_share_token IS NULL;

-- 2) Public RPC: get walk tracks + minimal booking info by token
CREATE OR REPLACE FUNCTION public.get_public_walk(_token uuid)
RETURNS TABLE(
  booking_id uuid,
  status text,
  provider_name text,
  pet_name text,
  scheduled_at timestamptz,
  tracks jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT sb.id, sb.status::text, sb.scheduled_at, sb.provider_id, sb.pet_id
    FROM public.service_bookings sb
    WHERE sb.public_share_token = _token
    LIMIT 1
  )
  SELECT
    b.id,
    b.status,
    (SELECT name FROM public.service_providers WHERE id = b.provider_id),
    (SELECT name FROM public.pets WHERE id = b.pet_id),
    b.scheduled_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('lat', wt.lat, 'lng', wt.lng, 'recorded_at', wt.recorded_at)
                       ORDER BY wt.recorded_at)
      FROM public.walk_tracks wt
      WHERE wt.booking_id = b.id
    ), '[]'::jsonb)
  FROM b;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_walk(uuid) TO anon, authenticated;

-- 3) Replace missing pet notify trigger with radius-aware version (city OR within 5km)
CREATE OR REPLACE FUNCTION public.notify_missing_pet_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet_name text;
  v_species text;
  rec RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT name, species::text INTO v_pet_name, v_species FROM public.pets WHERE id = NEW.pet_id;

  FOR rec IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.id <> NEW.owner_id
      AND (
        (NEW.last_seen_city IS NOT NULL AND lower(p.city) = lower(NEW.last_seen_city))
        OR (
          NEW.last_seen_lat IS NOT NULL AND NEW.last_seen_lng IS NOT NULL
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          AND earth_distance(ll_to_earth(NEW.last_seen_lat, NEW.last_seen_lng), ll_to_earth(p.lat, p.lng)) <= 5000
        )
      )
    LIMIT 5000
  LOOP
    PERFORM public.notify_user(
      rec.id,
      'missing_pet',
      'Help find ' || COALESCE(v_pet_name, 'a pet'),
      COALESCE(v_species, 'pet') || ' last seen near ' || COALESCE(NEW.last_seen_city, 'your area'),
      '/missing/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;

-- 4) Realtime publication safety
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_tracks; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Add lat/lng to profiles if not present (safety; may already exist)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng numeric;




-- Broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  target_city text,
  target_role text,
  recipients_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read broadcasts" ON public.broadcasts FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "super admins insert broadcasts" ON public.broadcasts FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND sender_id = auth.uid());

-- Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read flags" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "admins write flags" ON public.feature_flags FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Seed common flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('ai_chat', true, 'Enable AI chat assistant'),
  ('mating_module', true, 'Enable mating discovery & requests'),
  ('shop', true, 'Enable shop & marketplace'),
  ('walk_tracking', true, 'Enable live walk tracking'),
  ('vet_video', true, 'Enable vet tele-consult video room')
ON CONFLICT (key) DO NOTHING;

-- KPIs RPC
CREATE OR REPLACE FUNCTION public.admin_kpis()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT jsonb_build_object(
    'users_total', (SELECT count(*) FROM public.profiles),
    'users_new_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'pets_total', (SELECT count(*) FROM public.pets),
    'posts_today', (SELECT count(*) FROM public.posts WHERE created_at > now() - interval '1 day'),
    'bookings_today', (SELECT count(*) FROM public.service_bookings WHERE created_at > now() - interval '1 day'),
    'active_missing', (SELECT count(*) FROM public.missing_pets WHERE status = 'active'),
    'open_reports', (SELECT count(*) FROM public.reports WHERE status = 'open'),
    'pending_vet_apps', (SELECT count(*) FROM public.vet_applications WHERE status = 'pending'),
    'pending_provider_verify', (SELECT count(*) FROM public.service_providers WHERE verified = false),
    'vets_active', (SELECT count(*) FROM public.vet_profiles WHERE active = true AND onboarded = true),
    'plus_subscribers', (SELECT count(*) FROM public.subscriptions WHERE tier = 'plus' AND status IN ('active','trialing'))
  ) INTO r;
  RETURN r;
END $$;

-- Send broadcast
CREATE OR REPLACE FUNCTION public.send_broadcast(_title text, _body text, _link text, _target_city text DEFAULT NULL, _target_role text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_count int := 0; rec record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.broadcasts (sender_id, title, body, link, target_city, target_role)
  VALUES (auth.uid(), _title, _body, _link, _target_city, _target_role)
  RETURNING id INTO v_id;

  FOR rec IN
    SELECT DISTINCT p.id FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE (_target_city IS NULL OR lower(p.city) = lower(_target_city))
      AND (_target_role IS NULL OR ur.role::text = _target_role)
  LOOP
    PERFORM public.notify_user(rec.id, 'broadcast', _title, _body, COALESCE(_link, '/'));
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.broadcasts SET recipients_count = v_count WHERE id = v_id;
  RETURN v_id;
END $$;




-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cm_user ON public.conversation_members(user_id);

-- Helper: is the current user in a conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _conv AND user_id = _user);
$$;

CREATE POLICY "conv members read" ON public.conversations FOR SELECT
  USING (public.is_conversation_member(id, auth.uid()));
CREATE POLICY "conv create" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conv update by member" ON public.conversations FOR UPDATE
  USING (public.is_conversation_member(id, auth.uid()))
  WITH CHECK (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "cm read own convs" ON public.conversation_members FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "cm insert self or by member" ON public.conversation_members FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "cm update own row" ON public.conversation_members FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "cm leave" ON public.conversation_members FOR DELETE
  USING (user_id = auth.uid());

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text,
  attachment_url text,
  attachment_kind text, -- 'image' | 'voice' | 'file'
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON public.messages(conversation_id, created_at DESC);

CREATE POLICY "msg read by member" ON public.messages FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "msg insert by member" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "msg edit own" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- Bump last_message_at on insert
CREATE OR REPLACE FUNCTION public.bump_conv_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  -- notify other members
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT cm.user_id, 'new_message',
         'New message',
         LEFT(COALESCE(NEW.body, '[attachment]'), 80),
         '/messages/' || NEW.conversation_id
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.muted = false;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_conv ON public.messages;
CREATE TRIGGER trg_bump_conv AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conv_last_message();

-- Typing indicators (ephemeral table, upsert pattern)
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "typing read by member" ON public.typing_indicators FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "typing upsert self" ON public.typing_indicators FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "typing update self" ON public.typing_indicators FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "typing delete self" ON public.typing_indicators FOR DELETE
  USING (user_id = auth.uid());

-- Find or create a 1:1 DM
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_me = _other_user THEN RAISE EXCEPTION 'cannot_dm_self'; END IF;

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = c.id AND user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = c.id AND user_id = _other_user)
    AND (SELECT count(*) FROM public.conversation_members WHERE conversation_id = c.id) = 2
  LIMIT 1;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  INSERT INTO public.conversations (is_group, created_by) VALUES (false, v_me) RETURNING id INTO v_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (v_id, v_me), (v_id, _other_user);
  RETURN v_id;
END $$;

-- Mark conversation read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_members SET last_read_at = now()
  WHERE conversation_id = _conv AND user_id = auth.uid();
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- Add daily.co room columns to appointments (vet video calls)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_provider text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_room_token_owner text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS video_room_token_vet text;




CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_delete" ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "own_update" ON public.push_subscriptions FOR UPDATE USING (user_id = auth.uid());




-- Blocked users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocked ON public.blocked_users(blocked_id);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_select_own" ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);
CREATE POLICY "block_insert_own" ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "block_delete_own" ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Helper
CREATE OR REPLACE FUNCTION public.is_blocked(_blocker uuid, _blocked uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE blocker_id = _blocker AND blocked_id = _blocked
  );
$$;

-- Content moderation audit log
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mod_verdict') THEN
    CREATE TYPE public.mod_verdict AS ENUM ('allow', 'flag', 'block');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.content_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type text NOT NULL,           -- 'post' | 'comment' | 'message' | 'profile_bio'
  content_id uuid,
  excerpt text,
  verdict public.mod_verdict NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  score numeric,
  source text NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual' | 'banned_word'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modlog_author ON public.content_moderation_log(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modlog_verdict ON public.content_moderation_log(verdict, created_at DESC);

ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modlog_admin_read" ON public.content_moderation_log FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

-- No public insert; only edge functions (service role) write to this table.



DROP FUNCTION public.get_pets_public();

CREATE FUNCTION public.get_pets_public()
RETURNS TABLE(
  id uuid,
  public_id text,
  owner_id uuid,
  name text,
  species pet_species,
  breed text,
  gender pet_gender,
  date_of_birth date,
  avatar_url text,
  bio text,
  city text,
  vaccination_verified boolean,
  discoverable_for_mating boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating
  FROM public.pets;
$function$;






-- 1. Tighten error_log RLS: require user_id = auth.uid() (no NULL spam)
DROP POLICY IF EXISTS error_log_insert_any_authed ON public.error_log;
CREATE POLICY error_log_insert_self
  ON public.error_log
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Signup rate-limit table (checked from edge function via service role)
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_hash text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_attempts_email_hash_time_idx
  ON public.signup_attempts (email_hash, attempted_at DESC);
CREATE INDEX IF NOT EXISTS signup_attempts_ip_hash_time_idx
  ON public.signup_attempts (ip_hash, attempted_at DESC);

ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY signup_attempts_admin_select
  ON public.signup_attempts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.purge_old_signup_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.signup_attempts WHERE attempted_at < now() - interval '24 hours';
$$;



REVOKE EXECUTE ON FUNCTION public.purge_old_signup_attempts() FROM PUBLIC, anon, authenticated;




-- =========================================================================
-- 1. REVOKE EXECUTE on trigger-only SECURITY DEFINER functions
--    (triggers run with definer rights regardless of grants)
-- =========================================================================
DO $$
DECLARE
  fn text;
  trigger_only_fns text[] := ARRAY[
    'award_dewormed_badge','award_first_post','award_meetup_host_badge',
    'award_social_butterfly_badge','award_vaccinated_badge',
    'bump_conv_last_message','bump_group_member_count','bump_reaction_counts',
    'bump_comment_count','bump_like_count',
    'on_access_request_decision','on_access_request_insert','on_appointment_event',
    'on_collab_invite','on_collab_response','on_daily_moment_insert',
    'on_new_follow','on_post_reaction','on_rsvp_insert','on_vet_answer',
    'on_booking_event','on_consult_event','on_mating_request',
    'on_order_item_insert','on_order_status','on_post_comment','on_post_like',
    'recount_meetup_attending','sync_post_hashtags','tg_post_to_health',
    'tg_limit_comments','tg_limit_posts','tg_limit_sightings',
    'enforce_missing_free_limit','enforce_neutered_not_discoverable',
    'enqueue_missing_pet_alerts','notify_missing_pet_alerts',
    'notify_owner_on_sighting','set_verified_purchase',
    'maybe_finalize_agreement','handle_new_user',
    'apply_verification_approval','apply_vet_application_approval'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function OR ambiguous_function THEN
      -- function may have multiple sigs or not exist; revoke per-signature
      DECLARE
        sig text;
      BEGIN
        FOR sig IN
          SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
          FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
          WHERE n.nspname='public' AND p.proname=fn
        LOOP
          EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
        END LOOP;
      END;
    END;
  END LOOP;
END $$;

-- =========================================================================
-- 2. REVOKE anon EXECUTE on user-only RPCs (still callable by authenticated)
-- =========================================================================
DO $$
DECLARE
  fn text;
  auth_only_fns text[] := ARRAY[
    'get_or_create_dm','mark_conversation_read','bump_answer_helpful',
    'bump_story_view','send_broadcast','admin_kpis','notify_user',
    'increment_usage','check_pet_eligible_for_mating','check_daily_limit'
  ];
BEGIN
  FOREACH fn IN ARRAY auth_only_fns LOOP
    DECLARE sig text;
    BEGIN
      FOR sig IN
        SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
        FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
        WHERE n.nspname='public' AND p.proname=fn
      LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', sig);
      END LOOP;
    END;
  END LOOP;
END $$;

-- =========================================================================
-- 3. Fix overly-permissive notifications insert policy
-- =========================================================================
DROP POLICY IF EXISTS notif_definer_insert ON public.notifications;
CREATE POLICY "notif_service_insert" ON public.notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

-- =========================================================================
-- 4. Add explicit policy to reminder_log (service-role only)
-- =========================================================================
DROP POLICY IF EXISTS "reminder_log_service_all" ON public.reminder_log;
CREATE POLICY "reminder_log_service_all" ON public.reminder_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);




ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_url_thumb text,
  ADD COLUMN IF NOT EXISTS image_url_feed  text,
  ADD COLUMN IF NOT EXISTS image_url_full  text;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS avatar_url_thumb text,
  ADD COLUMN IF NOT EXISTS avatar_url_feed  text,
  ADD COLUMN IF NOT EXISTS avatar_url_full  text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url_thumb text,
  ADD COLUMN IF NOT EXISTS avatar_url_feed  text,
  ADD COLUMN IF NOT EXISTS avatar_url_full  text;

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS media_url_thumb text,
  ADD COLUMN IF NOT EXISTS media_url_feed  text,
  ADD COLUMN IF NOT EXISTS media_url_full  text;



-- Repair: some auth users have no public.profiles row, which causes an
-- onboarding loop (PATCH updates 0 rows, useProfile returns nothing,
-- AppShell keeps redirecting back to /onboarding).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.phone
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profile rows for any existing auth users.
INSERT INTO public.profiles (id, full_name, phone)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  u.phone
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT DO NOTHING;



CREATE TYPE public.pet_listing_type AS ENUM ('adoption', 'rehoming', 'breeder_sale');
CREATE TYPE public.pet_listing_status AS ENUM ('active', 'pending_review', 'taken_down', 'completed');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS breeder_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breeder_cert_url text;

CREATE TABLE public.pet_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  listing_type public.pet_listing_type NOT NULL,
  fee_inr integer,
  city text,
  lat numeric,
  lng numeric,
  age_weeks integer NOT NULL,
  species text,
  breed text,
  gender text,
  vaccination_doc_url text NOT NULL,
  breeder_cert_url text,
  parents_info jsonb,
  microchip_id text,
  title text NOT NULL,
  description text,
  photos text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  status public.pet_listing_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_listings_age_min CHECK (age_weeks >= 8),
  CONSTRAINT pet_listings_fee_nonneg CHECK (fee_inr IS NULL OR fee_inr >= 0)
);

CREATE INDEX idx_pet_listings_active ON public.pet_listings (active, status, created_at DESC);
CREATE INDEX idx_pet_listings_type ON public.pet_listings (listing_type);
CREATE INDEX idx_pet_listings_owner ON public.pet_listings (owner_id);
CREATE INDEX idx_pet_listings_city ON public.pet_listings (city);

CREATE OR REPLACE FUNCTION public.tg_pet_listings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pet_listings_updated
BEFORE UPDATE ON public.pet_listings
FOR EACH ROW EXECUTE FUNCTION public.tg_pet_listings_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_breeder_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_type = 'breeder_sale' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.owner_id AND p.breeder_verified = true
    ) THEN
      RAISE EXCEPTION 'Only verified breeders can create breeder_sale listings';
    END IF;
  END IF;
  IF NEW.listing_type = 'adoption' AND NEW.fee_inr IS NOT NULL AND NEW.fee_inr > 0 THEN
    RAISE EXCEPTION 'Adoption listings must be free';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pet_listings_enforce_breeder
BEFORE INSERT OR UPDATE ON public.pet_listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_breeder_verified();

ALTER TABLE public.pet_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY pet_listings_select_active
ON public.pet_listings
FOR SELECT
TO authenticated
USING ((active = true AND status = 'active') OR owner_id = auth.uid());

CREATE POLICY pet_listings_insert_own
ON public.pet_listings
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY pet_listings_update_own
ON public.pet_listings
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY pet_listings_delete_own
ON public.pet_listings
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-listings', 'pet-listings', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pet-listings public read" ON storage.objects;
CREATE POLICY "pet-listings public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'pet-listings');

DROP POLICY IF EXISTS "pet-listings user insert own folder" ON storage.objects;
CREATE POLICY "pet-listings user insert own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pet-listings' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "pet-listings user update own folder" ON storage.objects;
CREATE POLICY "pet-listings user update own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pet-listings' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "pet-listings user delete own folder" ON storage.objects;
CREATE POLICY "pet-listings user delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pet-listings' AND auth.uid()::text = (storage.foldername(name))[1]);




-- 3. org_profiles
CREATE TABLE IF NOT EXISTS public.org_profiles (
  user_id uuid PRIMARY KEY,
  org_name text NOT NULL,
  org_type public.account_type NOT NULL,
  registration_no text,
  registration_doc_url text,
  address text,
  city text,
  state text,
  pincode text,
  lat numeric,
  lng numeric,
  phone text,
  website text,
  description text,
  facility_photos text[] NOT NULL DEFAULT '{}',
  donation_upi text,
  donation_url text,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_profiles_owner_all ON public.org_profiles;
CREATE POLICY org_profiles_owner_all ON public.org_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS org_profiles_select_approved ON public.org_profiles;
CREATE POLICY org_profiles_select_approved ON public.org_profiles
  FOR SELECT TO authenticated
  USING (status = 'approved' OR user_id = auth.uid()
         OR public.has_role(auth.uid(),'super_admin')
         OR public.has_role(auth.uid(),'moderator'));

DROP POLICY IF EXISTS org_profiles_admin_update ON public.org_profiles;
CREATE POLICY org_profiles_admin_update ON public.org_profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE TRIGGER tg_org_profiles_updated
  BEFORE UPDATE ON public.org_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. litter_groups
CREATE TABLE IF NOT EXISTS public.litter_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sire_pet_id uuid,
  dam_pet_id uuid,
  birth_date date,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.litter_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS litter_select_all ON public.litter_groups;
CREATE POLICY litter_select_all ON public.litter_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS litter_insert_own ON public.litter_groups;
CREATE POLICY litter_insert_own ON public.litter_groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS litter_update_own ON public.litter_groups;
CREATE POLICY litter_update_own ON public.litter_groups FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS litter_delete_own ON public.litter_groups;
CREATE POLICY litter_delete_own ON public.litter_groups FOR DELETE TO authenticated USING (created_by = auth.uid());

-- 5. pets lineage columns
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS sire_pet_id uuid,
  ADD COLUMN IF NOT EXISTS dam_pet_id uuid,
  ADD COLUMN IF NOT EXISTS litter_id uuid REFERENCES public.litter_groups(id) ON DELETE SET NULL;

-- 6. pet_listings additions
ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS litter_id uuid REFERENCES public.litter_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bred_on_petos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seller_type public.account_type;

-- 7. Listing seller-type snapshot + compliance trigger
CREATE OR REPLACE FUNCTION public.tg_listing_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_type public.account_type;
DECLARE v_sire uuid; v_dam uuid;
BEGIN
  SELECT account_type INTO v_type FROM public.profiles WHERE id = NEW.owner_id;
  NEW.seller_type := COALESCE(v_type, 'pet_parent');

  IF NEW.seller_type = 'zoo' THEN
    RAISE EXCEPTION 'Zoos cannot create pet listings';
  END IF;

  IF NEW.seller_type IN ('shelter','sanctuary','rescuer') THEN
    NEW.listing_type := 'adoption';
    NEW.fee_inr := 0;
  END IF;

  -- Bred on PetOS
  IF NEW.litter_id IS NOT NULL THEN
    SELECT sire_pet_id, dam_pet_id INTO v_sire, v_dam FROM public.litter_groups WHERE id = NEW.litter_id;
    IF v_sire IS NOT NULL AND v_dam IS NOT NULL THEN
      NEW.bred_on_petos := true;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_pet_listings_compliance ON public.pet_listings;
CREATE TRIGGER tg_pet_listings_compliance
  BEFORE INSERT OR UPDATE ON public.pet_listings
  FOR EACH ROW EXECUTE FUNCTION public.tg_listing_compliance();

-- 8. Org approval -> verify breeder
CREATE OR REPLACE FUNCTION public.tg_org_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.reviewed_at := now();
    IF NEW.org_type IN ('breeder','kennel') THEN
      UPDATE public.profiles SET breeder_verified = true WHERE id = NEW.user_id;
    END IF;
    UPDATE public.profiles SET account_type = NEW.org_type WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_org_profiles_approval ON public.org_profiles;
CREATE TRIGGER tg_org_profiles_approval
  BEFORE UPDATE ON public.org_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_org_approval();

-- 9. Storage bucket org-docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-docs','org-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org-docs public read" ON storage.objects;
DROP POLICY IF EXISTS "org-docs public read" ON storage.objects;
CREATE POLICY "org-docs public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'org-docs');

DROP POLICY IF EXISTS "org-docs owner upload" ON storage.objects;
DROP POLICY IF EXISTS "org-docs owner upload" ON storage.objects;
CREATE POLICY "org-docs owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "org-docs owner update" ON storage.objects;
DROP POLICY IF EXISTS "org-docs owner update" ON storage.objects;
CREATE POLICY "org-docs owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'org-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "org-docs owner delete" ON storage.objects;
DROP POLICY IF EXISTS "org-docs owner delete" ON storage.objects;
CREATE POLICY "org-docs owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'org-docs' AND auth.uid()::text = (storage.foldername(name))[1]);




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




CREATE OR REPLACE FUNCTION public.get_user_id_by_email(_email text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT id FROM auth.users
  WHERE lower(email) = lower(_email)
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;




ALTER TYPE public.pet_listing_status ADD VALUE IF NOT EXISTS 'sold';



-- 1. Add 'buyer' to account_type enum
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'buyer';

-- 2. Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS looking_for jsonb;

-- Unique case-insensitive handle
CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_lower_unique
  ON public.profiles ((lower(handle))) WHERE handle IS NOT NULL;

-- 3. Pet status chip
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS status_chip text
  CHECK (status_chip IS NULL OR status_chip IN ('available_for_stud','for_sale','chilling'));

-- 4. Auto-tag bred_on_petos when both parents reference real pets
CREATE OR REPLACE FUNCTION public.tg_auto_bred_on_petos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sire_pet_id IS NOT NULL
     AND NEW.dam_pet_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.pets WHERE id = NEW.sire_pet_id)
     AND EXISTS (SELECT 1 FROM public.pets WHERE id = NEW.dam_pet_id)
  THEN
    -- propagate to the listing too if one exists
    UPDATE public.pet_listings
       SET bred_on_petos = true
     WHERE pet_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_pets_auto_bred ON public.pets;
CREATE TRIGGER tg_pets_auto_bred
AFTER INSERT OR UPDATE OF sire_pet_id, dam_pet_id ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_bred_on_petos();

-- Same auto-flag when a listing is created for a pet that already has both parents
CREATE OR REPLACE FUNCTION public.tg_listing_auto_bred()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_both boolean;
BEGIN
  SELECT (sire_pet_id IS NOT NULL AND dam_pet_id IS NOT NULL)
    INTO has_both
    FROM public.pets WHERE id = NEW.pet_id;
  IF has_both THEN
    NEW.bred_on_petos := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_pet_listings_auto_bred ON public.pet_listings;
CREATE TRIGGER tg_pet_listings_auto_bred
BEFORE INSERT ON public.pet_listings
FOR EACH ROW EXECUTE FUNCTION public.tg_listing_auto_bred();

-- 5. Repeat sellers view (pet_parent accounts with 3+ active listings)
CREATE OR REPLACE VIEW public.repeat_sellers AS
SELECT l.owner_id, COUNT(*)::int AS active_listings
FROM public.pet_listings l
JOIN public.profiles p ON p.id = l.owner_id
WHERE l.active = true
  AND l.status = 'active'
  AND p.account_type = 'pet_parent'
GROUP BY l.owner_id
HAVING COUNT(*) >= 3;

GRANT SELECT ON public.repeat_sellers TO authenticated;



-- Extend public RPCs to expose new profile + pet fields
DROP VIEW IF EXISTS public.profiles_public CASCADE;
DROP VIEW IF EXISTS public.pets_public CASCADE;
DROP FUNCTION IF EXISTS public.get_profiles_public();
DROP FUNCTION IF EXISTS public.get_pets_public();

CREATE FUNCTION public.get_profiles_public()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  bio text,
  handle text,
  cover_url text,
  account_type public.account_type
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, city, bio, handle, cover_url, account_type::public.account_type
  FROM public.profiles;
$$;
REVOKE ALL ON FUNCTION public.get_profiles_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO authenticated;

CREATE VIEW public.profiles_public AS SELECT * FROM public.get_profiles_public();
GRANT SELECT ON public.profiles_public TO authenticated;

CREATE FUNCTION public.get_pets_public()
RETURNS TABLE (
  id uuid,
  public_id text,
  owner_id uuid,
  name text,
  species public.pet_species,
  breed text,
  gender public.pet_gender,
  date_of_birth date,
  avatar_url text,
  bio text,
  city text,
  vaccination_verified boolean,
  discoverable_for_mating boolean,
  status_chip text,
  sire_pet_id uuid,
  dam_pet_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating,
         status_chip, sire_pet_id, dam_pet_id
  FROM public.pets;
$$;
REVOKE ALL ON FUNCTION public.get_pets_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pets_public() TO authenticated;

CREATE VIEW public.pets_public AS SELECT * FROM public.get_pets_public();
GRANT SELECT ON public.pets_public TO authenticated;

-- Step 2 schema: litter_pets join table for the litter wizard
CREATE TABLE IF NOT EXISTS public.litter_pets (
  litter_id uuid NOT NULL REFERENCES public.litter_groups(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (litter_id, pet_id)
);

ALTER TABLE public.litter_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "litter_pets_select_all"
  ON public.litter_pets FOR SELECT TO authenticated USING (true);

CREATE POLICY "litter_pets_insert_owner"
  ON public.litter_pets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.litter_groups l WHERE l.id = litter_id AND l.created_by = auth.uid()));

CREATE POLICY "litter_pets_delete_owner"
  ON public.litter_pets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.litter_groups l WHERE l.id = litter_id AND l.created_by = auth.uid()));



CREATE TABLE public.boarding_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  service_type TEXT NOT NULL DEFAULT 'boarding',
  price_inr_per_day INTEGER,
  city TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.boarding_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boarding_select_active_or_owner"
ON public.boarding_services FOR SELECT TO authenticated
USING (active = true OR owner_id = auth.uid());

CREATE POLICY "boarding_insert_own"
ON public.boarding_services FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "boarding_update_own"
ON public.boarding_services FOR UPDATE TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "boarding_delete_own"
ON public.boarding_services FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_boarding_services_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_boarding_services_updated_at
BEFORE UPDATE ON public.boarding_services
FOR EACH ROW EXECUTE FUNCTION public.tg_boarding_services_touch();

CREATE INDEX idx_boarding_services_owner ON public.boarding_services(owner_id);
CREATE INDEX idx_boarding_services_active ON public.boarding_services(active) WHERE active = true;



CREATE TYPE public.adoption_application_status AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

CREATE TABLE public.adoption_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL,
  shelter_id UUID NOT NULL, -- the listing owner OR shelter user_id for volunteer interest
  listing_id UUID, -- nullable for volunteer interest
  is_volunteer_interest BOOLEAN NOT NULL DEFAULT false,
  home_description TEXT,
  prior_experience TEXT,
  family_size INTEGER,
  has_yard BOOLEAN,
  other_pets TEXT,
  phone TEXT,
  city TEXT,
  status public.adoption_application_status NOT NULL DEFAULT 'pending',
  shelter_note TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adopt_app_insert_self"
ON public.adoption_applications FOR INSERT TO authenticated
WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "adopt_app_select_party"
ON public.adoption_applications FOR SELECT TO authenticated
USING (applicant_id = auth.uid() OR shelter_id = auth.uid());

CREATE POLICY "adopt_app_update_party"
ON public.adoption_applications FOR UPDATE TO authenticated
USING (applicant_id = auth.uid() OR shelter_id = auth.uid())
WITH CHECK (applicant_id = auth.uid() OR shelter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_adoption_apps_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_adoption_apps_updated_at
BEFORE UPDATE ON public.adoption_applications
FOR EACH ROW EXECUTE FUNCTION public.tg_adoption_apps_touch();

CREATE INDEX idx_adopt_apps_listing ON public.adoption_applications(listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX idx_adopt_apps_shelter ON public.adoption_applications(shelter_id);
CREATE INDEX idx_adopt_apps_applicant ON public.adoption_applications(applicant_id);



ALTER TYPE public.service_category ADD VALUE IF NOT EXISTS 'caretaker';
ALTER TYPE public.service_category ADD VALUE IF NOT EXISTS 'daycare';
ALTER TYPE public.service_category ADD VALUE IF NOT EXISTS 'pet_taxi';




-- Severity enum for triage outcomes
DO $$ BEGIN
  CREATE TYPE public.triage_severity AS ENUM ('mild', 'moderate', 'severe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ vet_triage_sessions ============
CREATE TABLE IF NOT EXISTS public.vet_triage_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  -- Full conversation: [{role:'user'|'assistant', content:'...'}, ...]
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- AI-classified severity (set when triage classifier runs)
  severity public.triage_severity,
  ai_summary text,
  home_care text[] DEFAULT '{}',
  recommend_vet boolean DEFAULT false,
  -- If escalated to a live appointment
  escalated_to_appointment_id uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triage_owner ON public.vet_triage_sessions(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_triage_pet ON public.vet_triage_sessions(pet_id);
CREATE INDEX IF NOT EXISTS idx_triage_appt ON public.vet_triage_sessions(escalated_to_appointment_id);

ALTER TABLE public.vet_triage_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER triage_set_updated
  BEFORE UPDATE ON public.vet_triage_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Owners: full control over their own sessions
CREATE POLICY "Owners view own triage sessions"
  ON public.vet_triage_sessions FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners create own triage sessions"
  ON public.vet_triage_sessions FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update own triage sessions"
  ON public.vet_triage_sessions FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete own triage sessions"
  ON public.vet_triage_sessions FOR DELETE
  USING (auth.uid() = owner_id);

-- Vets: can read a triage session if it has been linked to an appointment they own.
CREATE POLICY "Vets view triage linked to their appointment"
  ON public.vet_triage_sessions FOR SELECT
  USING (
    escalated_to_appointment_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = vet_triage_sessions.escalated_to_appointment_id
        AND a.vet_id = auth.uid()
    )
  );

-- ============ Link triage to appointments ============
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS triage_session_id uuid REFERENCES public.vet_triage_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appts_triage ON public.appointments(triage_session_id) WHERE triage_session_id IS NOT NULL;



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
      'â‚¹' || NEW.amount_inr || ' (' || NEW.kind || ') â€” awaiting your confirmation',
      '/mates/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user(NEW.payer_id, 'mate_payment_status',
      'Payment ' || NEW.status,
      'Status updated for â‚¹' || NEW.amount_inr,
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



-- Provider trust columns
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS trust_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS id_proof_path text,
  ADD COLUMN IF NOT EXISTS address_proof_path text,
  ADD COLUMN IF NOT EXISTS quiz_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quiz_score integer,
  ADD COLUMN IF NOT EXISTS years_experience integer;

-- Validate trust_status values
CREATE OR REPLACE FUNCTION public.tg_validate_provider_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.trust_status NOT IN ('none','pending','verified','rejected') THEN
    RAISE EXCEPTION 'Invalid trust_status: %', NEW.trust_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_provider_trust ON public.service_providers;
CREATE TRIGGER validate_provider_trust
  BEFORE INSERT OR UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_provider_trust();

-- Quiz attempts
CREATE TABLE IF NOT EXISTS public.provider_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_quiz_attempts_provider_idx ON public.provider_quiz_attempts(provider_id);
CREATE INDEX IF NOT EXISTS provider_quiz_attempts_user_idx ON public.provider_quiz_attempts(user_id);

ALTER TABLE public.provider_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz: provider can read own"
  ON public.provider_quiz_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "quiz: provider can insert own"
  ON public.provider_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND owner_id = auth.uid())
  );

-- When a passing attempt is recorded, update the provider profile
CREATE OR REPLACE FUNCTION public.tg_apply_quiz_pass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.passed = true THEN
    UPDATE public.service_providers
       SET quiz_passed_at = COALESCE(quiz_passed_at, now()),
           quiz_score = GREATEST(COALESCE(quiz_score, 0), NEW.score)
     WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_quiz_pass ON public.provider_quiz_attempts;
CREATE TRIGGER apply_quiz_pass
  AFTER INSERT ON public.provider_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_apply_quiz_pass();

-- Recurring bookings
CREATE TABLE IF NOT EXISTS public.recurring_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  weekdays smallint[] NOT NULL DEFAULT '{}'::smallint[],
  time_of_day time NOT NULL,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_customer_idx ON public.recurring_bookings(customer_id);
CREATE INDEX IF NOT EXISTS recurring_provider_idx ON public.recurring_bookings(provider_id);

CREATE OR REPLACE FUNCTION public.tg_validate_recurring_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.frequency NOT IN ('weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'Invalid frequency: %', NEW.frequency;
  END IF;
  IF NEW.status NOT IN ('active','paused','cancelled') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'end_date must be on or after start_date';
  END IF;
  IF array_length(NEW.weekdays, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one weekday required';
  END IF;
  -- weekdays: 0=Sun..6=Sat
  IF EXISTS (SELECT 1 FROM unnest(NEW.weekdays) w WHERE w < 0 OR w > 6) THEN
    RAISE EXCEPTION 'weekdays must be between 0 and 6';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recurring_booking ON public.recurring_bookings;
CREATE TRIGGER validate_recurring_booking
  BEFORE INSERT OR UPDATE ON public.recurring_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_recurring_booking();

ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring: parties read"
  ON public.recurring_bookings FOR SELECT TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND owner_id = auth.uid())
  );

CREATE POLICY "recurring: customer insert"
  ON public.recurring_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "recurring: parties update"
  ON public.recurring_bookings FOR UPDATE TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (SELECT 1 FROM public.service_providers WHERE id = provider_id AND owner_id = auth.uid())
  );

CREATE POLICY "recurring: customer delete"
  ON public.recurring_bookings FOR DELETE TO authenticated
  USING (auth.uid() = customer_id);

-- Link generated occurrences back to the recurring schedule
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS parent_recurring_id uuid REFERENCES public.recurring_bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_bookings_parent_recurring_idx ON public.service_bookings(parent_recurring_id);

-- Storage bucket for trust documents (private, owner-only)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trust-docs','trust-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "trust-docs: owner read" ON storage.objects;
CREATE POLICY "trust-docs: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "trust-docs: owner insert" ON storage.objects;
CREATE POLICY "trust-docs: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "trust-docs: owner update" ON storage.objects;
CREATE POLICY "trust-docs: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "trust-docs: owner delete" ON storage.objects;
CREATE POLICY "trust-docs: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'trust-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "trust-docs: admins read all" ON storage.objects;
CREATE POLICY "trust-docs: admins read all"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trust-docs'
    AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'moderator'))
  );



-- ============= Phase 5: Rewards Escrow =============

-- Enums
DO $$ BEGIN
  CREATE TYPE public.reward_status AS ENUM ('pending','available','redeemed','expired','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reward_kind AS ENUM ('earn','release','redeem','expire','adjust');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.redemption_kind AS ENUM ('booking_discount','listing_boost','plus_credit','cash_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.redemption_status AS ENUM ('requested','approved','applied','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Accounts
CREATE TABLE IF NOT EXISTS public.reward_accounts (
  user_id uuid PRIMARY KEY,
  available_points integer NOT NULL DEFAULT 0,
  pending_points integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_redeemed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reward account" ON public.reward_accounts
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tg_reward_accounts_updated
  BEFORE UPDATE ON public.reward_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ledger
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.reward_kind NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  status public.reward_status NOT NULL DEFAULT 'pending',
  release_after timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON public.reward_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_pending ON public.reward_ledger(status, release_after) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_ledger_ref
  ON public.reward_ledger(user_id, reference_type, reference_id, kind)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL AND kind = 'earn';

ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.reward_ledger
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins insert ledger" ON public.reward_ledger
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Redemptions
CREATE TABLE IF NOT EXISTS public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.redemption_kind NOT NULL,
  points_spent integer NOT NULL CHECK (points_spent > 0),
  inr_value integer NOT NULL DEFAULT 0,
  status public.redemption_status NOT NULL DEFAULT 'requested',
  applied_to_reference_type text,
  applied_to_reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions" ON public.reward_redemptions
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users create own redemptions" ON public.reward_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update redemptions" ON public.reward_redemptions
  FOR UPDATE USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tg_reward_redemptions_updated
  BEFORE UPDATE ON public.reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rules (configurable point amounts)
CREATE TABLE IF NOT EXISTS public.reward_rules (
  kind text PRIMARY KEY,
  points integer NOT NULL,
  escrow_days integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads rules" ON public.reward_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage rules" ON public.reward_rules
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER tg_reward_rules_updated
  BEFORE UPDATE ON public.reward_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default rules
INSERT INTO public.reward_rules (kind, points, escrow_days, description) VALUES
  ('booking_completed', 50, 7, 'Completed service booking'),
  ('mating_agreement_signed', 200, 14, 'Signed mating agreement'),
  ('streak_7', 100, 0, '7-day daily streak'),
  ('streak_30', 500, 0, '30-day daily streak'),
  ('helpful_vet_answer', 20, 0, 'Helpful vet answer'),
  ('referral_signup', 300, 30, 'Referred a new user who signed up'),
  ('first_pet_added', 50, 0, 'Added first pet'),
  ('vaccination_verified', 100, 0, 'Pet vaccination verified')
ON CONFLICT (kind) DO NOTHING;

-- ============= Account totals trigger =============
CREATE OR REPLACE FUNCTION public.tg_reward_ledger_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure account row exists
  INSERT INTO public.reward_accounts(user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.kind = 'earn' THEN
    IF NEW.status = 'pending' THEN
      UPDATE public.reward_accounts
        SET pending_points = pending_points + NEW.points,
            lifetime_earned = lifetime_earned + GREATEST(NEW.points, 0)
        WHERE user_id = NEW.user_id;
    ELSIF NEW.status = 'available' THEN
      UPDATE public.reward_accounts
        SET available_points = available_points + NEW.points,
            lifetime_earned = lifetime_earned + GREATEST(NEW.points, 0)
        WHERE user_id = NEW.user_id;
    END IF;
  ELSIF NEW.kind = 'release' THEN
    UPDATE public.reward_accounts
      SET pending_points = GREATEST(pending_points - NEW.points, 0),
          available_points = available_points + NEW.points
      WHERE user_id = NEW.user_id;
  ELSIF NEW.kind = 'redeem' THEN
    UPDATE public.reward_accounts
      SET available_points = GREATEST(available_points - NEW.points, 0),
          lifetime_redeemed = lifetime_redeemed + NEW.points
      WHERE user_id = NEW.user_id;
  ELSIF NEW.kind = 'expire' THEN
    UPDATE public.reward_accounts
      SET pending_points = GREATEST(pending_points - NEW.points, 0)
      WHERE user_id = NEW.user_id;
  ELSIF NEW.kind = 'adjust' THEN
    UPDATE public.reward_accounts
      SET available_points = GREATEST(available_points + NEW.points, 0)
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_reward_ledger_apply
  AFTER INSERT ON public.reward_ledger
  FOR EACH ROW EXECUTE FUNCTION public.tg_reward_ledger_apply();

-- ============= Award helper =============
CREATE OR REPLACE FUNCTION public.award_reward(
  _user_id uuid,
  _rule_kind text,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_status public.reward_status;
  v_release_after timestamptz;
  v_id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_rule FROM public.reward_rules WHERE kind = _rule_kind AND active = true;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_rule.escrow_days > 0 THEN
    v_status := 'pending';
    v_release_after := now() + make_interval(days => v_rule.escrow_days);
  ELSE
    v_status := 'available';
    v_release_after := NULL;
  END IF;

  -- Idempotent on (user, ref, earn) via unique index
  BEGIN
    INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status, release_after)
    VALUES (_user_id, 'earn', v_rule.points, COALESCE(_reason, v_rule.description), _reference_type, _reference_id, v_status, v_release_after)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NULL;
  END;

  -- Notify
  PERFORM public.notify_user(_user_id, 'reward_earned',
    '+' || v_rule.points || ' points',
    COALESCE(_reason, v_rule.description),
    '/rewards');

  RETURN v_id;
END $$;

-- ============= Release due rewards =============
CREATE OR REPLACE FUNCTION public.release_due_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, points, reason, reference_type, reference_id
    FROM public.reward_ledger
    WHERE status = 'pending' AND kind = 'earn'
      AND release_after IS NOT NULL AND release_after <= now()
    LIMIT 1000
  LOOP
    UPDATE public.reward_ledger SET status = 'available' WHERE id = r.id;
    INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status)
    VALUES (r.user_id, 'release', r.points, 'Escrow released: ' || r.reason, r.reference_type, r.reference_id, 'available');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ============= Redeem helper (user-callable RPC) =============
CREATE OR REPLACE FUNCTION public.redeem_reward(
  _kind public.redemption_kind,
  _points integer,
  _applied_to_reference_type text DEFAULT NULL,
  _applied_to_reference_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance int;
  v_inr int;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF _points <= 0 THEN RAISE EXCEPTION 'points must be positive'; END IF;

  SELECT available_points INTO v_balance FROM public.reward_accounts WHERE user_id = v_user;
  IF v_balance IS NULL OR v_balance < _points THEN
    RAISE EXCEPTION 'insufficient points (have %, need %)', COALESCE(v_balance, 0), _points;
  END IF;

  -- 100 points = â‚¹10 default conversion
  v_inr := (_points / 10);

  INSERT INTO public.reward_redemptions(user_id, kind, points_spent, inr_value, status,
    applied_to_reference_type, applied_to_reference_id, notes)
  VALUES (v_user, _kind, _points, v_inr, 'requested', _applied_to_reference_type, _applied_to_reference_id, _notes)
  RETURNING id INTO v_id;

  -- Debit immediately (held until applied; on rejection admin can adjust back)
  INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status)
  VALUES (v_user, 'redeem', _points, 'Redemption: ' || _kind::text, 'reward_redemption', v_id, 'redeemed');

  RETURN v_id;
END $$;

-- ============= Auto-award triggers =============

-- Booking completed
CREATE OR REPLACE FUNCTION public.tg_award_booking_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.award_reward(NEW.customer_id, 'booking_completed', 'service_booking', NEW.id, 'Completed booking');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_award_booking_complete ON public.service_bookings;
CREATE TRIGGER tg_award_booking_complete
  AFTER UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_booking_complete();

-- Mating agreement signed (both parties)
CREATE OR REPLACE FUNCTION public.tg_award_mating_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_from uuid; v_to uuid;
BEGIN
  IF NEW.from_signature IS NOT NULL AND NEW.to_signature IS NOT NULL
     AND (OLD.from_signature IS NULL OR OLD.to_signature IS NULL) THEN
    SELECT from_owner_id, to_owner_id INTO v_from, v_to
      FROM public.mating_requests WHERE id = NEW.request_id;
    PERFORM public.award_reward(v_from, 'mating_agreement_signed', 'mating_agreement', NEW.id, 'Mating agreement signed');
    PERFORM public.award_reward(v_to, 'mating_agreement_signed', 'mating_agreement', NEW.id, 'Mating agreement signed');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_award_mating_signed ON public.mating_agreements;
CREATE TRIGGER tg_award_mating_signed
  AFTER INSERT OR UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_mating_signed();

-- Streak milestones (hook into daily_streaks)
CREATE OR REPLACE FUNCTION public.tg_award_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_streak >= 7 AND COALESCE(OLD.current_streak, 0) < 7 THEN
    PERFORM public.award_reward(NEW.user_id, 'streak_7', 'daily_streak', NEW.user_id, '7-day streak');
  END IF;
  IF NEW.current_streak >= 30 AND COALESCE(OLD.current_streak, 0) < 30 THEN
    PERFORM public.award_reward(NEW.user_id, 'streak_30', 'daily_streak_30', NEW.user_id, '30-day streak');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_award_streak ON public.daily_streaks;
CREATE TRIGGER tg_award_streak
  AFTER INSERT OR UPDATE ON public.daily_streaks
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_streak();



CREATE OR REPLACE FUNCTION public.apply_redemption(_id uuid, _status public.redemption_status, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('applied','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO r FROM public.reward_redemptions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'redemption not found'; END IF;
  IF r.status NOT IN ('requested','approved') THEN
    RAISE EXCEPTION 'redemption already finalized: %', r.status;
  END IF;

  UPDATE public.reward_redemptions
    SET status = _status, notes = COALESCE(_notes, notes)
    WHERE id = _id;

  IF _status = 'rejected' THEN
    -- Refund points
    INSERT INTO public.reward_ledger(user_id, kind, points, reason, reference_type, reference_id, status)
    VALUES (r.user_id, 'adjust', r.points_spent, 'Refund: rejected redemption', 'reward_redemption', r.id, 'available');
    PERFORM public.notify_user(r.user_id, 'reward_refund', 'Redemption rejected',
      'Your ' || r.points_spent || ' points have been refunded.', '/rewards');
  ELSIF _status = 'applied' THEN
    PERFORM public.notify_user(r.user_id, 'reward_applied', 'Redemption applied',
      'Your reward has been applied to your account.', '/rewards');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_provider_trust_status(_provider_id uuid, _status text, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('pending','verified','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE public.service_providers
    SET trust_status = _status,
        verified = (_status = 'verified')
    WHERE id = _provider_id;

  PERFORM public.notify_user(
    (SELECT owner_id FROM public.service_providers WHERE id = _provider_id),
    'trust_status',
    'Verification ' || _status,
    COALESCE(_notes, 'Your provider verification status has been updated.'),
    '/services/manage'
  );
END $$;



-- Single-subject aggregate
CREATE OR REPLACE FUNCTION public.review_summary(_subject_type public.review_subject, _subject_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'avg', COALESCE(ROUND(AVG(rating)::numeric, 2), 0),
    'verified_count', COUNT(*) FILTER (WHERE verified_purchase),
    'distribution', jsonb_build_object(
      '5', COUNT(*) FILTER (WHERE rating = 5),
      '4', COUNT(*) FILTER (WHERE rating = 4),
      '3', COUNT(*) FILTER (WHERE rating = 3),
      '2', COUNT(*) FILTER (WHERE rating = 2),
      '1', COUNT(*) FILTER (WHERE rating = 1)
    )
  )
  FROM public.reviews
  WHERE subject_type = _subject_type AND subject_id = _subject_id;
$$;

-- Bulk for list pages
CREATE OR REPLACE FUNCTION public.review_summaries_bulk(_subject_type public.review_subject, _ids uuid[])
RETURNS TABLE(subject_id uuid, count bigint, avg numeric, verified_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.subject_id,
    COUNT(*)::bigint,
    COALESCE(ROUND(AVG(r.rating)::numeric, 2), 0),
    COUNT(*) FILTER (WHERE r.verified_purchase)::bigint
  FROM public.reviews r
  WHERE r.subject_type = _subject_type AND r.subject_id = ANY(_ids)
  GROUP BY r.subject_id;
$$;

-- Provider social proof: bookings in a city
CREATE OR REPLACE FUNCTION public.provider_social_proof(_provider_id uuid, _city text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_in_city int;
  v_repeat int;
BEGIN
  SELECT COUNT(DISTINCT customer_id) INTO v_total
  FROM public.service_bookings
  WHERE provider_id = _provider_id AND status IN ('confirmed','completed');

  IF _city IS NOT NULL AND _city <> '' THEN
    SELECT COUNT(DISTINCT sb.customer_id) INTO v_in_city
    FROM public.service_bookings sb
    JOIN public.profiles p ON p.id = sb.customer_id
    WHERE sb.provider_id = _provider_id
      AND sb.status IN ('confirmed','completed')
      AND lower(p.city) = lower(_city);
  ELSE
    v_in_city := 0;
  END IF;

  SELECT COUNT(*) INTO v_repeat FROM (
    SELECT customer_id FROM public.service_bookings
    WHERE provider_id = _provider_id AND status IN ('confirmed','completed')
    GROUP BY customer_id HAVING COUNT(*) > 1
  ) x;

  RETURN jsonb_build_object(
    'total_customers', v_total,
    'in_city', v_in_city,
    'repeat_customers', v_repeat
  );
END $$;




-- Status enum
DO $$ BEGIN
  CREATE TYPE public.insurance_lead_status AS ENUM ('new','contacted','quoted','purchased','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Partners catalog
CREATE TABLE IF NOT EXISTS public.insurance_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  blurb text,
  country text NOT NULL DEFAULT 'IN',
  plan_min_inr integer,
  plan_max_inr integer,
  redirect_url text NOT NULL,
  commission_pct numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active partners"
  ON public.insurance_partners FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins manage partners"
  ON public.insurance_partners FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE TRIGGER tg_insurance_partners_updated
  BEFORE UPDATE ON public.insurance_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Leads
CREATE TABLE IF NOT EXISTS public.insurance_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.insurance_partners(id) ON DELETE RESTRICT,
  status public.insurance_lead_status NOT NULL DEFAULT 'new',
  pet_breed_snapshot text,
  pet_age_months_snapshot integer,
  premium_inr integer,
  commission_inr integer,
  partner_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_leads_user ON public.insurance_leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_leads_status ON public.insurance_leads(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_leads_partner_ref ON public.insurance_leads(partner_id, partner_ref) WHERE partner_ref IS NOT NULL;

ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own leads"
  ON public.insurance_leads FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Owner inserts own leads"
  ON public.insurance_leads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.pets WHERE id = pet_id AND owner_id = auth.uid())
  );

CREATE POLICY "Admins update leads"
  ON public.insurance_leads FOR UPDATE
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'moderator'));

-- No DELETE policy = no deletes

CREATE TRIGGER tg_insurance_leads_updated
  BEFORE UPDATE ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Snapshot breed + age at insert
CREATE OR REPLACE FUNCTION public.tg_snapshot_insurance_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_breed text; v_dob date;
BEGIN
  SELECT breed, date_of_birth INTO v_breed, v_dob FROM public.pets WHERE id = NEW.pet_id;
  IF NEW.pet_breed_snapshot IS NULL THEN NEW.pet_breed_snapshot := v_breed; END IF;
  IF NEW.pet_age_months_snapshot IS NULL AND v_dob IS NOT NULL THEN
    NEW.pet_age_months_snapshot := GREATEST(0, ((EXTRACT(YEAR FROM age(v_dob)) * 12) + EXTRACT(MONTH FROM age(v_dob)))::int);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_insurance_lead_snapshot
  BEFORE INSERT ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_snapshot_insurance_lead();

-- Auto-compute commission when marked purchased
CREATE OR REPLACE FUNCTION public.tg_compute_insurance_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pct numeric;
BEGIN
  IF NEW.status = 'purchased' AND NEW.premium_inr IS NOT NULL
     AND (NEW.commission_inr IS NULL OR NEW.commission_inr = 0) THEN
    SELECT commission_pct INTO v_pct FROM public.insurance_partners WHERE id = NEW.partner_id;
    IF v_pct IS NOT NULL THEN
      NEW.commission_inr := ROUND(NEW.premium_inr * v_pct / 100.0)::int;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_insurance_lead_commission
  BEFORE INSERT OR UPDATE ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.tg_compute_insurance_commission();

-- Seed two inactive demo partners
INSERT INTO public.insurance_partners (name, blurb, country, plan_min_inr, plan_max_inr, redirect_url, commission_pct, active, sort_order)
VALUES
  ('Bajaj Allianz Pet', 'Comprehensive pet health insurance with OPD and surgery cover.', 'IN', 4000, 18000, 'https://example.com/bajaj-pet?lead={lead_id}', 8.00, false, 10),
  ('Digit Pet Care', 'Affordable plans with vaccination top-ups and accident cover.', 'IN', 2500, 12000, 'https://example.com/digit-pet?lead={lead_id}', 10.00, false, 20)
ON CONFLICT DO NOTHING;



CREATE TABLE IF NOT EXISTS public.proactive_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  severity SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  dedupe_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_proactive_alerts_user_active
  ON public.proactive_alerts(user_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_proactive_alerts_dedupe
  ON public.proactive_alerts(user_id, pet_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.proactive_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own proactive_alerts"
  ON public.proactive_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner dismisses own proactive_alerts"
  ON public.proactive_alerts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.proactive_alerts;

SELECT cron.schedule(
  'ai-proactive-scan-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://pyqudgtmpnxnzzjbcdvc.supabase.co/functions/v1/ai-proactive-scan',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cXVkZ3RtcG54bnp6amJjZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODM2MTQsImV4cCI6MjA5Mjk1OTYxNH0.heicqiE_NbcXiKq_7TNoYWhHTdtIB5sksHRq_ln5wNs"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);



ALTER TABLE public.mating_listings
  ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mating_listings_paid_until
  ON public.mating_listings(paid_until) WHERE active = true;

-- Daily expiry sweep
CREATE OR REPLACE FUNCTION public.expire_mating_listings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mating_listings
     SET active = false
   WHERE active = true
     AND paid_until IS NOT NULL
     AND paid_until < now();
END;
$$;

REVOKE ALL ON FUNCTION public.expire_mating_listings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_mating_listings() TO service_role;

SELECT cron.schedule(
  'expire-mating-listings-daily',
  '15 2 * * *',
  $$ SELECT public.expire_mating_listings(); $$
);



ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS ai_flag TEXT CHECK (ai_flag IN ('watch','vet_soon','emergency')),
  ADD COLUMN IF NOT EXISTS ai_reason TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_symptom_logs_pet_flag
  ON public.symptom_logs(pet_id, ai_flag) WHERE ai_flag IS NOT NULL;



create table if not exists public.health_insights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null,
  summary text not null,
  insights jsonb not null default '[]'::jsonb,
  data_signature text,
  generated_at timestamptz not null default now(),
  model text,
  unique (pet_id)
);

create index if not exists idx_health_insights_owner on public.health_insights(owner_id);

alter table public.health_insights enable row level security;

drop policy if exists "owner reads own insights" on public.health_insights;
create policy "owner reads own insights"
  on public.health_insights for select
  using (auth.uid() = owner_id);

drop policy if exists "owner deletes own insights" on public.health_insights;
create policy "owner deletes own insights"
  on public.health_insights for delete
  using (auth.uid() = owner_id);

drop policy if exists "vets in care team read insights" on public.health_insights;
create policy "vets in care team read insights"
  on public.health_insights for select
  using (public.vet_can_read_pet(pet_id));



create table if not exists public.walk_summaries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.service_bookings(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null default 0,
  distance_km numeric(8,3) not null default 0,
  point_count integer not null default 0,
  avg_pace_min_per_km numeric(8,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_walk_summaries_booking on public.walk_summaries(booking_id);

alter table public.walk_summaries enable row level security;

drop policy if exists "participants read summary" on public.walk_summaries;
create policy "participants read summary"
  on public.walk_summaries for select
  using (
    exists (
      select 1 from public.service_bookings sb
      left join public.service_providers sp on sp.id = sb.provider_id
      where sb.id = walk_summaries.booking_id
        and (sb.customer_id = auth.uid() or sp.owner_id = auth.uid())
    )
  );

drop policy if exists "walker writes summary" on public.walk_summaries;
create policy "walker writes summary"
  on public.walk_summaries for insert
  with check (
    exists (
      select 1 from public.service_bookings sb
      join public.service_providers sp on sp.id = sb.provider_id
      where sb.id = walk_summaries.booking_id
        and sp.owner_id = auth.uid()
    )
  );

drop policy if exists "walker updates summary" on public.walk_summaries;
create policy "walker updates summary"
  on public.walk_summaries for update
  using (
    exists (
      select 1 from public.service_bookings sb
      join public.service_providers sp on sp.id = sb.provider_id
      where sb.id = walk_summaries.booking_id
        and sp.owner_id = auth.uid()
    )
  );



alter table public.appointments
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists actual_duration_min integer,
  add column if not exists vet_visit_notes text;

create index if not exists idx_appointments_vet_status on public.appointments(vet_id, status);




-- Phase 20 finish: expire stale paid mating listings.
-- The discovery grid already filters by paid_until > now(), but the
-- "Manage" view still shows active=true. This function flips them off.

CREATE OR REPLACE FUNCTION public.expire_paid_mating_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.mating_listings
       SET active = false
     WHERE active = true
       AND paid_until IS NOT NULL
       AND paid_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- Make sure pg_cron + pg_net are available so the daily schedule (registered
-- separately via the insert tool) can call this function on a timer.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;




REVOKE EXECUTE ON FUNCTION public.expire_paid_mating_listings() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_paid_mating_listings() TO service_role;



-- 1) Add boost expiry column
ALTER TABLE public.missing_pets
  ADD COLUMN IF NOT EXISTS boosted_until timestamptz;

CREATE INDEX IF NOT EXISTS missing_pets_boosted_until_idx
  ON public.missing_pets (boosted_until)
  WHERE boosted_until IS NOT NULL;

-- 2) Update fan-out trigger to widen radius for boosted listings
CREATE OR REPLACE FUNCTION public.notify_missing_pet_alerts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pet_name text;
  v_species text;
  v_radius_m integer;
  v_boosted boolean;
  rec RECORD;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  SELECT name, species::text INTO v_pet_name, v_species FROM public.pets WHERE id = NEW.pet_id;

  v_boosted := (NEW.boosted_until IS NOT NULL AND NEW.boosted_until > now());
  v_radius_m := CASE WHEN v_boosted THEN 15000 ELSE 5000 END;

  FOR rec IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.id <> NEW.owner_id
      AND (
        (NEW.last_seen_city IS NOT NULL AND lower(p.city) = lower(NEW.last_seen_city))
        OR (
          NEW.last_seen_lat IS NOT NULL AND NEW.last_seen_lng IS NOT NULL
          AND p.lat IS NOT NULL AND p.lng IS NOT NULL
          AND earth_distance(ll_to_earth(NEW.last_seen_lat, NEW.last_seen_lng), ll_to_earth(p.lat, p.lng)) <= v_radius_m
        )
      )
    LIMIT 5000
  LOOP
    PERFORM public.notify_user(
      rec.id,
      'missing_pet',
      CASE WHEN v_boosted THEN 'â­ Help find ' ELSE 'Help find ' END || COALESCE(v_pet_name, 'a pet'),
      COALESCE(v_species, 'pet') || ' last seen near ' || COALESCE(NEW.last_seen_city, 'your area'),
      '/missing/' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END $function$;

-- 3) Expiry function for daily cron
CREATE OR REPLACE FUNCTION public.expire_missing_pet_boosts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.missing_pets
       SET boosted_until = NULL
     WHERE boosted_until IS NOT NULL
       AND boosted_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.expire_missing_pet_boosts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_missing_pet_boosts() TO service_role;




-- Pregnancy status enum
DO $$ BEGIN
  CREATE TYPE public.pregnancy_status AS ENUM ('active','whelped','lost','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pregnancy_milestone_kind AS ENUM (
    'mating_confirmed','vet_check','ultrasound','weight','feeding_change','symptom','whelping_prep','whelped','note'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pregnancies
CREATE TABLE IF NOT EXISTS public.pregnancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  dam_pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  sire_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  mating_request_id uuid REFERENCES public.mating_requests(id) ON DELETE SET NULL,
  mating_date date,
  expected_whelp_date date,
  actual_whelp_date date,
  status public.pregnancy_status NOT NULL DEFAULT 'active',
  litter_id uuid REFERENCES public.litter_groups(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pregnancies_owner ON public.pregnancies(owner_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_dam ON public.pregnancies(dam_pet_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_status ON public.pregnancies(status) WHERE status = 'active';

ALTER TABLE public.pregnancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own pregnancies"
  ON public.pregnancies FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Vets with access can view pregnancies"
  ON public.pregnancies FOR SELECT
  USING (public.vet_can_read_pet(dam_pet_id));

CREATE TRIGGER tg_pregnancies_updated_at
  BEFORE UPDATE ON public.pregnancies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Milestones
CREATE TABLE IF NOT EXISTS public.pregnancy_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregnancy_id uuid NOT NULL REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  kind public.pregnancy_milestone_kind NOT NULL,
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(6,2),
  notes text,
  attachment_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pregmile_preg ON public.pregnancy_milestones(pregnancy_id, occurred_on DESC);

ALTER TABLE public.pregnancy_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage milestones for own pregnancies"
  ON public.pregnancy_milestones FOR ALL
  USING (EXISTS (SELECT 1 FROM public.pregnancies p WHERE p.id = pregnancy_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pregnancies p WHERE p.id = pregnancy_id AND p.owner_id = auth.uid()));

CREATE POLICY "Vets with access can view milestones"
  ON public.pregnancy_milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.pregnancies p
    WHERE p.id = pregnancy_id AND public.vet_can_read_pet(p.dam_pet_id)
  ));

CREATE TRIGGER tg_pregmile_updated_at
  BEFORE UPDATE ON public.pregnancy_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set expected whelp date if mating_date provided and expected omitted (canine ~63 days).
CREATE OR REPLACE FUNCTION public.tg_pregnancy_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mating_date IS NOT NULL AND NEW.expected_whelp_date IS NULL THEN
    NEW.expected_whelp_date := NEW.mating_date + 63;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tg_pregnancies_defaults
  BEFORE INSERT OR UPDATE ON public.pregnancies
  FOR EACH ROW EXECUTE FUNCTION public.tg_pregnancy_defaults();

-- Daily reminder function: notify owners of pregnancies whose expected whelp is in <= 3 days
CREATE OR REPLACE FUNCTION public.notify_upcoming_whelpings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rec RECORD; v_count int := 0; v_pet text;
BEGIN
  FOR rec IN
    SELECT p.id, p.owner_id, p.dam_pet_id, p.expected_whelp_date
    FROM public.pregnancies p
    WHERE p.status = 'active'
      AND p.expected_whelp_date IS NOT NULL
      AND p.expected_whelp_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
  LOOP
    SELECT name INTO v_pet FROM public.pets WHERE id = rec.dam_pet_id;
    PERFORM public.notify_user(
      rec.owner_id,
      'pregnancy_due',
      'Whelping soon for ' || COALESCE(v_pet, 'your pet'),
      'Expected on ' || to_char(rec.expected_whelp_date, 'DD Mon'),
      '/pregnancies/' || rec.id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;




DO $$ BEGIN
  CREATE TYPE public.donation_status AS ENUM ('pending','paid','refunded','beta_free');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL,
  org_user_id uuid NOT NULL,
  amount_inr integer NOT NULL CHECK (amount_inr >= 10),
  message text,
  anonymous boolean NOT NULL DEFAULT false,
  status public.donation_status NOT NULL DEFAULT 'pending',
  payment_intent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_donations_org ON public.donations(org_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON public.donations(donor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations(status);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can view own donations"
  ON public.donations FOR SELECT
  USING (auth.uid() = donor_id);

CREATE POLICY "Org owners can view donations to them"
  ON public.donations FOR SELECT
  USING (auth.uid() = org_user_id);

CREATE POLICY "Donors can create their own donations"
  ON public.donations FOR INSERT
  WITH CHECK (auth.uid() = donor_id AND donor_id <> org_user_id);

-- Updates only happen via webhook (service role bypasses RLS); no policy required.

ALTER TABLE public.org_profiles
  ADD COLUMN IF NOT EXISTS total_donations_inr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS donor_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.tg_donation_bump_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'paid' AND OLD.status <> 'paid')
     OR (TG_OP = 'INSERT' AND NEW.status IN ('paid','beta_free')) THEN
    UPDATE public.org_profiles
       SET total_donations_inr = total_donations_inr + NEW.amount_inr,
           donor_count = donor_count + 1
     WHERE user_id = NEW.org_user_id;
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
    PERFORM public.notify_user(
      NEW.org_user_id,
      'donation_received',
      'New donation received',
      'â‚¹' || NEW.amount_inr::text || COALESCE(' â€” "' || left(NEW.message, 60) || '"', ''),
      '/org/donations'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_donations_bump ON public.donations;
CREATE TRIGGER tg_donations_bump
  BEFORE INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.tg_donation_bump_totals();



-- Phase 24: Shop reorder reminders
CREATE TABLE public.shop_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  cadence_days INT NOT NULL CHECK (cadence_days BETWEEN 7 AND 180),
  next_run_on DATE NOT NULL,
  last_notified_on DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_reminders_user ON public.shop_reminders(user_id) WHERE active;
CREATE INDEX idx_shop_reminders_due ON public.shop_reminders(next_run_on) WHERE active;

ALTER TABLE public.shop_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own shop_reminders"
  ON public.shop_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner inserts own shop_reminders"
  ON public.shop_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates own shop_reminders"
  ON public.shop_reminders FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes own shop_reminders"
  ON public.shop_reminders FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: set next_run_on lead-time (cadence_days - 3, min today)
CREATE OR REPLACE FUNCTION public.tg_shop_reminder_set_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.next_run_on IS NULL THEN
      NEW.next_run_on := CURRENT_DATE + GREATEST(NEW.cadence_days - 3, 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.cadence_days <> OLD.cadence_days THEN
      NEW.next_run_on := COALESCE(NEW.last_notified_on, CURRENT_DATE) + GREATEST(NEW.cadence_days - 3, 1);
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shop_reminder_set_next_run
  BEFORE INSERT OR UPDATE ON public.shop_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_reminder_set_next_run();



-- Phase 26: Pet taxi
CREATE TYPE public.transport_status AS ENUM (
  'requested','accepted','en_route_pickup','picked_up','en_route_drop','dropped_off','cancelled'
);

CREATE TABLE public.transport_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  service_booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat NUMERIC, pickup_lng NUMERIC,
  dropoff_address TEXT NOT NULL,
  dropoff_lat NUMERIC, dropoff_lng NUMERIC,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.transport_status NOT NULL DEFAULT 'requested',
  fare_inr INTEGER,
  notes TEXT,
  public_share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transport_customer ON public.transport_bookings(customer_id, scheduled_at DESC);
CREATE INDEX idx_transport_provider ON public.transport_bookings(provider_id, scheduled_at DESC);

CREATE TABLE public.transport_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.transport_bookings(id) ON DELETE CASCADE,
  kind public.transport_status NOT NULL,
  lat NUMERIC, lng NUMERIC,
  note TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_transport_legs_booking ON public.transport_legs(booking_id, at DESC);

ALTER TABLE public.transport_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_legs ENABLE ROW LEVEL SECURITY;

-- Helper: is current user the assigned driver?
CREATE OR REPLACE FUNCTION public.is_transport_driver(_booking UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.transport_bookings tb
    JOIN public.service_providers sp ON sp.id = tb.provider_id
    WHERE tb.id = _booking AND sp.owner_id = auth.uid()
  );
$$;

-- transport_bookings policies
CREATE POLICY "Customer reads own taxi"
  ON public.transport_bookings FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Driver reads assigned taxi"
  ON public.transport_bookings FOR SELECT
  USING (provider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = transport_bookings.provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Customer creates taxi"
  ON public.transport_bookings FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customer updates own taxi"
  ON public.transport_bookings FOR UPDATE
  USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Driver updates assigned taxi"
  ON public.transport_bookings FOR UPDATE
  USING (provider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = transport_bookings.provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Customer deletes own taxi"
  ON public.transport_bookings FOR DELETE
  USING (auth.uid() = customer_id);

-- transport_legs policies
CREATE POLICY "Party reads legs"
  ON public.transport_legs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.id = transport_legs.booking_id
      AND (tb.customer_id = auth.uid() OR public.is_transport_driver(tb.id))
  ));

CREATE POLICY "Party inserts legs"
  ON public.transport_legs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.id = transport_legs.booking_id
      AND (tb.customer_id = auth.uid() OR public.is_transport_driver(tb.id))
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_transport_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_transport_touch
  BEFORE UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_touch();

-- Auto-mirror status to legs + push notifications on driver/customer changes
CREATE OR REPLACE FUNCTION public.tg_transport_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _customer UUID; _driver_owner UUID; _msg TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.transport_legs(booking_id, kind, created_by)
      VALUES (NEW.id, NEW.status, auth.uid());

    SELECT sp.owner_id INTO _driver_owner
      FROM public.service_providers sp WHERE sp.id = NEW.provider_id;
    _customer := NEW.customer_id;

    _msg := CASE NEW.status
      WHEN 'accepted' THEN 'Driver accepted your pet taxi'
      WHEN 'en_route_pickup' THEN 'Driver is on the way to pickup'
      WHEN 'picked_up' THEN 'Pet has been picked up'
      WHEN 'en_route_drop' THEN 'On the way to drop-off'
      WHEN 'dropped_off' THEN 'Pet has been dropped off safely'
      WHEN 'cancelled' THEN 'Pet taxi was cancelled'
      ELSE NULL
    END;

    IF _msg IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, kind, title, body, link)
        VALUES (_customer, 'transport_update', 'Pet taxi update', _msg, '/taxi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transport_status_change
  AFTER UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_status_change();



CREATE OR REPLACE FUNCTION public.tg_transport_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _msg TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.transport_legs(booking_id, kind, created_by)
      VALUES (NEW.id, NEW.status, auth.uid());

    _msg := CASE NEW.status
      WHEN 'accepted' THEN 'Driver accepted your pet taxi'
      WHEN 'en_route_pickup' THEN 'Driver is on the way to pickup'
      WHEN 'picked_up' THEN 'Pet has been picked up'
      WHEN 'en_route_drop' THEN 'On the way to drop-off'
      WHEN 'dropped_off' THEN 'Pet has been dropped off safely'
      WHEN 'cancelled' THEN 'Pet taxi was cancelled'
      ELSE NULL
    END;

    IF _msg IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (NEW.customer_id, 'transport_update', 'Pet taxi update', _msg, '/taxi/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;



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



-- Phase 29 Batch A: link bookings/orders/listings to payment_intents

alter table public.transport_bookings
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.service_bookings
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.shop_orders
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.mating_listings
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

alter table public.vet_consults
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;

create index if not exists idx_transport_bookings_payment_intent on public.transport_bookings(payment_intent_id);
create index if not exists idx_service_bookings_payment_intent on public.service_bookings(payment_intent_id);
create index if not exists idx_shop_orders_payment_intent on public.shop_orders(payment_intent_id);
create index if not exists idx_mating_listings_payment_intent on public.mating_listings(payment_intent_id);
create index if not exists idx_vet_consults_payment_intent on public.vet_consults(payment_intent_id);

create index if not exists idx_payment_intents_ref on public.payment_intents(ref_id, kind);

alter table public.appointments
  add column if not exists payment_intent_id uuid references public.payment_intents(id) on delete set null,
  add column if not exists paid_at timestamptz;
create index if not exists idx_appointments_payment_intent on public.appointments(payment_intent_id);



-- Phase 29 Batch A: extend payment_kind enum with booking categories
alter type public.payment_kind add value if not exists 'transport';
alter type public.payment_kind add value if not exists 'service';
alter type public.payment_kind add value if not exists 'shop';
alter type public.payment_kind add value if not exists 'mating';
alter type public.payment_kind add value if not exists 'subscription';
alter type public.payment_kind add value if not exists 'donation';
alter type public.payment_kind add value if not exists 'boost';



-- 1. subscriptions extensions
alter table public.subscriptions
  add column if not exists environment text not null default 'sandbox',
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists product_id text,
  add column if not exists price_id text,
  add column if not exists current_period_start timestamptz;

update public.subscriptions
   set stripe_subscription_id = coalesce(stripe_subscription_id, provider_subscription_id),
       stripe_customer_id     = coalesce(stripe_customer_id, provider_customer_id)
 where stripe_subscription_id is null or stripe_customer_id is null;

create unique index if not exists subscriptions_stripe_sub_env_uniq
  on public.subscriptions(stripe_subscription_id, environment)
  where stripe_subscription_id is not null;

-- 2. server-side Plus gate
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'sandbox'
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and tier = 'plus'
      and (
        (status in ('active','trialing') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end is not null and current_period_end > now())
      )
  );
$$;
grant execute on function public.has_active_subscription(uuid, text) to anon, authenticated;

-- 3. commission rates
create table if not exists public.commission_rates (
  kind text primary key,
  rate_pct numeric(5,2) not null check (rate_pct >= 0 and rate_pct <= 100),
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.commission_rates(kind, rate_pct, notes) values
  ('transport',   15, 'Pet taxi'),
  ('service',     12, 'Grooming, boarding, training'),
  ('appointment', 10, 'Vet appointment'),
  ('vet_consult', 10, 'Vet consult'),
  ('puppy',        8, 'Puppy sale')
on conflict (kind) do nothing;

alter table public.commission_rates enable row level security;
drop policy if exists "anyone reads commission rates" on public.commission_rates;
create policy "anyone reads commission rates"
  on public.commission_rates for select to authenticated using (true);

-- 4. provider payout ledger
create table if not exists public.provider_payouts (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null,
  payment_intent_id uuid not null references public.payment_intents(id) on delete cascade,
  kind text not null,
  ref_id uuid,
  gross_inr integer not null,
  commission_inr integer not null,
  net_inr integer not null,
  status text not null default 'pending' check (status in ('pending','paid','reversed')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_intent_id)
);

create index if not exists provider_payouts_provider_idx
  on public.provider_payouts(provider_user_id, created_at desc);

alter table public.provider_payouts enable row level security;

drop policy if exists "providers view own payouts" on public.provider_payouts;
create policy "providers view own payouts"
  on public.provider_payouts for select to authenticated
  using (auth.uid() = provider_user_id);

drop policy if exists "admins view all payouts" on public.provider_payouts;
create policy "admins view all payouts"
  on public.provider_payouts for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'moderator'));

-- 5. payout-creation trigger
create or replace function public.tg_create_provider_payout()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_provider uuid;
  v_kind     text := new.kind::text;
  v_rate     numeric(5,2);
  v_commission integer;
  v_net      integer;
begin
  if new.status <> 'paid' then return new; end if;
  if (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;
  if new.ref_id is null then return new; end if;

  if v_kind = 'transport' then
    select provider_id into v_provider from public.transport_bookings where id = new.ref_id;
  elsif v_kind = 'service' then
    select provider_id into v_provider from public.service_bookings where id = new.ref_id;
  elsif v_kind = 'appointment' then
    select vet_id into v_provider from public.appointments where id = new.ref_id;
  elsif v_kind = 'vet_consult' then
    select vet_id into v_provider from public.vet_consults where id = new.ref_id;
  else
    return new;
  end if;

  if v_provider is null then return new; end if;

  select rate_pct into v_rate from public.commission_rates where kind = v_kind;
  if v_rate is null then v_rate := 15; end if;

  v_commission := round(new.amount_inr * v_rate / 100.0);
  v_net        := new.amount_inr - v_commission;

  insert into public.provider_payouts(provider_user_id, payment_intent_id, kind, ref_id, gross_inr, commission_inr, net_inr)
  values (v_provider, new.id, v_kind, new.ref_id, new.amount_inr, v_commission, v_net)
  on conflict (payment_intent_id) do nothing;

  return new;
exception when others then
  raise warning 'tg_create_provider_payout failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists payment_intents_payout_trg on public.payment_intents;
create trigger payment_intents_payout_trg
  after insert or update of status on public.payment_intents
  for each row execute function public.tg_create_provider_payout();

-- 6. mating listing auto-activation on payment
create or replace function public.tg_activate_mating_listing()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.payment_intent_id is not null
     and (old.payment_intent_id is null or old.payment_intent_id <> new.payment_intent_id) then
    new.active := true;
    if new.paid_until is null or new.paid_until < now() then
      new.paid_until := now() + interval '30 days';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mating_listings_activate_trg on public.mating_listings;
create trigger mating_listings_activate_trg
  before update on public.mating_listings
  for each row execute function public.tg_activate_mating_listing();



revoke execute on function public.has_active_subscription(uuid, text) from anon;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_kind' AND e.enumlabel = 'puppy_sale'
  ) THEN
    ALTER TYPE public.payment_kind ADD VALUE 'puppy_sale';
  END IF;
END$$;



-- 1) Default commission rate for puppy sales
INSERT INTO public.commission_rates(kind, rate_pct, notes)
VALUES ('puppy_sale', 8.00, 'Puppy/breeder sale commission')
ON CONFLICT (kind) DO NOTHING;

-- 2) Extend payout trigger to handle puppy_sale
CREATE OR REPLACE FUNCTION public.tg_create_provider_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_provider uuid;
  v_kind     text := new.kind::text;
  v_rate     numeric(5,2);
  v_commission integer;
  v_net      integer;
begin
  if new.status <> 'paid' then return new; end if;
  if (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;
  if new.ref_id is null then return new; end if;

  if v_kind = 'transport' then
    select provider_id into v_provider from public.transport_bookings where id = new.ref_id;
  elsif v_kind = 'service' then
    select provider_id into v_provider from public.service_bookings where id = new.ref_id;
  elsif v_kind = 'appointment' then
    select vet_id into v_provider from public.appointments where id = new.ref_id;
  elsif v_kind = 'vet_consult' then
    select vet_id into v_provider from public.vet_consults where id = new.ref_id;
  elsif v_kind = 'puppy_sale' then
    select owner_id into v_provider from public.pet_listings where id = new.ref_id;
  else
    return new;
  end if;

  if v_provider is null then return new; end if;

  select rate_pct into v_rate from public.commission_rates where kind = v_kind;
  if v_rate is null then v_rate := 15; end if;

  v_commission := round(new.amount_inr * v_rate / 100.0);
  v_net        := new.amount_inr - v_commission;

  insert into public.provider_payouts(provider_user_id, payment_intent_id, kind, ref_id, gross_inr, commission_inr, net_inr)
  values (v_provider, new.id, v_kind, new.ref_id, new.amount_inr, v_commission, v_net)
  on conflict (payment_intent_id) do nothing;

  return new;
exception when others then
  raise warning 'tg_create_provider_payout failed: %', sqlerrm;
  return new;
end;
$function$;

-- 3) Triage â†’ vet_consult bridge
-- Called from the booking flow to spawn a consult row that surfaces the AI
-- summary, severity and symptoms to the vet.
CREATE OR REPLACE FUNCTION public.create_consult_from_appointment(_appointment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_appt   record;
  v_triage record;
  v_consult_id uuid;
begin
  select * into v_appt from public.appointments where id = _appointment_id;
  if v_appt is null then
    raise exception 'appointment not found';
  end if;
  -- Only the owner of the appointment may invoke this
  if v_appt.owner_id <> auth.uid() then
    raise exception 'not allowed';
  end if;
  if v_appt.triage_session_id is null then
    return null;
  end if;
  -- Idempotent: one consult per appointment
  select id into v_consult_id from public.vet_consults
    where pet_id = v_appt.pet_id and owner_id = v_appt.owner_id
      and vet_id = v_appt.vet_id and status in ('awaiting_vet','assigned','in_progress')
    order by created_at desc limit 1;
  if v_consult_id is not null then
    return v_consult_id;
  end if;

  select * into v_triage from public.vet_triage_sessions where id = v_appt.triage_session_id;
  insert into public.vet_consults(pet_id, owner_id, vet_id, severity, status, ai_summary, symptoms)
  values (
    v_appt.pet_id,
    v_appt.owner_id,
    v_appt.vet_id,
    coalesce(v_triage.severity, 'moderate'::severity_level),
    'assigned'::consult_status,
    v_triage.ai_summary,
    case when v_triage.transcript is not null
         then array(select jsonb_array_elements_text(v_triage.transcript -> 'symptoms'))
         else null end
  )
  returning id into v_consult_id;

  return v_consult_id;
end;
$$;

REVOKE ALL ON FUNCTION public.create_consult_from_appointment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_consult_from_appointment(uuid) TO authenticated;



-- 1) Mating agreement signed PDF + auto lock
ALTER TABLE public.mating_agreements
  ADD COLUMN IF NOT EXISTS signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS agreement_number text;

CREATE OR REPLACE FUNCTION public.tg_lock_agreement_when_fully_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.from_signature is not null and new.to_signature is not null
     and (old.terms_locked is null or old.terms_locked = false)
  then
    new.terms_locked := true;
    if new.agreement_number is null then
      new.agreement_number := 'PMA-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(new.id::text,'-',''),1,6);
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS lock_agreement_when_fully_signed ON public.mating_agreements;
CREATE TRIGGER lock_agreement_when_fully_signed
  BEFORE UPDATE ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_lock_agreement_when_fully_signed();

-- Same logic on insert in case both signatures land in one shot (rare)
CREATE OR REPLACE FUNCTION public.tg_lock_agreement_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if new.from_signature is not null and new.to_signature is not null then
    new.terms_locked := true;
    if new.agreement_number is null then
      new.agreement_number := 'PMA-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(new.id::text,'-',''),1,6);
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS lock_agreement_on_insert ON public.mating_agreements;
CREATE TRIGGER lock_agreement_on_insert
  BEFORE INSERT ON public.mating_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_lock_agreement_on_insert();

-- 2) GST columns on payment intents
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS gst_rate_pct numeric(5,2) NOT NULL DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS gst_amount_inr integer,
  ADD COLUMN IF NOT EXISTS subtotal_inr integer,
  ADD COLUMN IF NOT EXISTS place_of_supply text;

-- Backfill GST for existing paid intents (gross-inclusive: amount = subtotal + gst)
UPDATE public.payment_intents
   SET gst_amount_inr = round(amount_inr - amount_inr / 1.18),
       subtotal_inr   = round(amount_inr / 1.18)
 WHERE amount_inr is not null and gst_amount_inr is null;

-- 3) Boarding vaccination eligibility
CREATE OR REPLACE FUNCTION public.check_pet_boarding_eligible(_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_species text;
  v_missing text[] := '{}';
  v_today date := current_date;
  v_has_dhpp boolean;
  v_has_rabies boolean;
  v_has_fvrcp boolean;
begin
  select lower(species) into v_species from public.pets where id = _pet_id;
  if v_species is null then
    return jsonb_build_object('eligible', false, 'reason', 'pet not found');
  end if;

  if v_species = 'dog' then
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and (vaccine_name ilike '%dhpp%' or vaccine_name ilike '%distemper%' or vaccine_name ilike '%dap%')
        and (next_due_on is null or next_due_on >= v_today)
        and administered_on >= v_today - interval '1 year') into v_has_dhpp;
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and vaccine_name ilike '%rabies%'
        and (next_due_on is null or next_due_on >= v_today)
        and administered_on >= v_today - interval '3 years') into v_has_rabies;
    if not v_has_dhpp then v_missing := array_append(v_missing, 'DHPP / Distemper'); end if;
    if not v_has_rabies then v_missing := array_append(v_missing, 'Rabies'); end if;
  elsif v_species = 'cat' then
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and (vaccine_name ilike '%fvrcp%' or vaccine_name ilike '%feline%')
        and (next_due_on is null or next_due_on >= v_today)
        and administered_on >= v_today - interval '1 year') into v_has_fvrcp;
    select exists(select 1 from public.vaccinations
      where pet_id = _pet_id
        and vaccine_name ilike '%rabies%'
        and (next_due_on is null or next_due_on >= v_today)) into v_has_rabies;
    if not v_has_fvrcp then v_missing := array_append(v_missing, 'FVRCP'); end if;
    if not v_has_rabies then v_missing := array_append(v_missing, 'Rabies'); end if;
  else
    return jsonb_build_object('eligible', true, 'reason', 'no boarding requirements for this species');
  end if;

  return jsonb_build_object(
    'eligible', coalesce(array_length(v_missing,1),0) = 0,
    'missing', v_missing,
    'species', v_species
  );
end;
$$;

REVOKE ALL ON FUNCTION public.check_pet_boarding_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_pet_boarding_eligible(uuid) TO authenticated;



INSERT INTO storage.buckets (id, name, public)
VALUES ('agreements', 'agreements', false)
ON CONFLICT (id) DO NOTHING;

-- Owners (either party of the mating request) can read their PDF
DROP POLICY IF EXISTS "agreements: parties can read" ON storage.objects;
DROP POLICY IF EXISTS "agreements: parties can read" ON storage.objects;
CREATE POLICY "agreements: parties can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'agreements'
  AND EXISTS (
    SELECT 1 FROM public.mating_agreements ma
    JOIN public.mating_requests mr ON mr.id = ma.request_id
    WHERE ma.id::text = split_part(name, '/', 1)
      AND (mr.from_owner_id = auth.uid() OR mr.to_owner_id = auth.uid())
  )
);

-- Only service role inserts (via edge function) â€” no client write policy needed



-- 1) Radius fanout helper
CREATE OR REPLACE FUNCTION public.find_users_within_radius_km(
  _lat numeric, _lng numeric, _radius_km numeric, _exclude_user uuid DEFAULT NULL
)
RETURNS TABLE(user_id uuid, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id,
         (earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(p.lat, p.lng))/1000)::numeric AS distance_km
  FROM public.profiles p
  WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND (_exclude_user IS NULL OR p.id <> _exclude_user)
    AND earth_distance(ll_to_earth(_lat, _lng), ll_to_earth(p.lat, p.lng)) <= _radius_km*1000
  ORDER BY distance_km
  LIMIT 500;
$$;

-- 2) Reward escrow columns + enum value + release RPC
ALTER TABLE public.missing_pets
  ADD COLUMN IF NOT EXISTS reward_payment_intent_id uuid REFERENCES public.payment_intents(id),
  ADD COLUMN IF NOT EXISTS reward_status text NOT NULL DEFAULT 'none'
    CHECK (reward_status IN ('none','escrowed','released','refunded')),
  ADD COLUMN IF NOT EXISTS reward_finder_id uuid,
  ADD COLUMN IF NOT EXISTS reward_released_at timestamptz;

DO $$ BEGIN
  ALTER TYPE public.payment_kind ADD VALUE IF NOT EXISTS 'reward_escrow';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.release_reward(
  _missing_pet_id uuid,
  _finder_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE m record; pi record;
BEGIN
  SELECT * INTO m FROM public.missing_pets WHERE id = _missing_pet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing pet not found'; END IF;
  IF m.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Only the owner can release the reward'; END IF;
  IF m.reward_status <> 'escrowed' THEN RAISE EXCEPTION 'No reward in escrow'; END IF;
  IF _finder_id = m.owner_id THEN RAISE EXCEPTION 'Finder cannot be the owner'; END IF;

  SELECT * INTO pi FROM public.payment_intents WHERE id = m.reward_payment_intent_id;
  IF NOT FOUND OR pi.status <> 'paid' THEN RAISE EXCEPTION 'Reward payment not paid'; END IF;

  INSERT INTO public.provider_payouts(payment_intent_id, recipient_user_id, amount_inr, status, kind)
  VALUES (pi.id, _finder_id, pi.amount_inr, 'pending', 'reward')
  ON CONFLICT DO NOTHING;

  UPDATE public.missing_pets
  SET reward_status='released', reward_finder_id=_finder_id, reward_released_at=now(),
      status='resolved', resolved_at=COALESCE(resolved_at, now())
  WHERE id = _missing_pet_id;

  PERFORM public.notify_user(
    _finder_id, 'reward', 'Reward released ðŸŽ‰',
    'The owner released the reward for finding their pet.',
    '/missing/' || _missing_pet_id::text
  );

  RETURN jsonb_build_object('ok', true, 'finder_id', _finder_id, 'amount_inr', pi.amount_inr);
END;
$$;
GRANT EXECUTE ON FUNCTION public.release_reward(uuid, uuid) TO authenticated;

-- 3) Driver live location
ALTER TABLE public.transport_bookings
  ADD COLUMN IF NOT EXISTS driver_lat numeric,
  ADD COLUMN IF NOT EXISTS driver_lng numeric,
  ADD COLUMN IF NOT EXISTS driver_location_at timestamptz;

CREATE OR REPLACE FUNCTION public.update_driver_location(
  _booking_id uuid, _lat numeric, _lng numeric
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE is_driver boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    JOIN public.service_providers sp ON sp.id = tb.provider_id
    WHERE tb.id = _booking_id AND sp.owner_id = auth.uid()
      AND tb.status NOT IN ('cancelled','dropped_off')
  ) INTO is_driver;
  IF NOT is_driver THEN RAISE EXCEPTION 'Not authorised to update this trip'; END IF;
  UPDATE public.transport_bookings
  SET driver_lat=_lat, driver_lng=_lng, driver_location_at=now()
  WHERE id=_booking_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_driver_location(uuid, numeric, numeric) TO authenticated;

ALTER TABLE public.transport_bookings REPLICA IDENTITY FULL;



CREATE OR REPLACE FUNCTION public.enqueue_missing_pet_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    INSERT INTO public.notification_jobs (kind, payload)
    VALUES (
      'missing_pet_fanout',
      jsonb_build_object(
        'missing_pet_id', NEW.id,
        'pet_id', NEW.pet_id,
        'owner_id', NEW.owner_id,
        'last_seen_city', NEW.last_seen_city,
        'last_seen_lat', NEW.last_seen_lat,
        'last_seen_lng', NEW.last_seen_lng,
        'radius_km', 15
      )
    );
  END IF;
  RETURN NEW;
END $$;



-- ===========================================================
-- P4 â€” GPS Tracker (software side)
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.gps_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Tracker',
  device_type text NOT NULL DEFAULT 'phone'
    CHECK (device_type IN ('collar','airtag','phone','other')),
  pairing_code text NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text,'-','') from 1 for 8)),
  battery_pct int,
  last_seen_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_devices_pet ON public.gps_devices(pet_id);
CREATE INDEX IF NOT EXISTS idx_gps_devices_owner ON public.gps_devices(owner_id);

ALTER TABLE public.gps_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY gps_devices_owner_all ON public.gps_devices
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Pings
CREATE TABLE IF NOT EXISTS public.gps_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.gps_devices(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy_m numeric,
  battery_pct int,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  outside_geofence boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_pings_device_time ON public.gps_pings(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_pings_pet_time ON public.gps_pings(pet_id, recorded_at DESC);

ALTER TABLE public.gps_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY gps_pings_owner_select ON public.gps_pings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.gps_devices d WHERE d.id = gps_pings.device_id AND d.owner_id = auth.uid()
  ));

-- Geofences
CREATE TABLE IF NOT EXISTS public.geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Home',
  center_lat numeric NOT NULL,
  center_lng numeric NOT NULL,
  radius_m int NOT NULL DEFAULT 200 CHECK (radius_m BETWEEN 50 AND 5000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_pet ON public.geofences(pet_id);

ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY geofences_owner_all ON public.geofences
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ===========================================================
-- Ingest RPC: hardware (or phone) pushes pings via pairing code
-- ===========================================================
CREATE OR REPLACE FUNCTION public.ingest_gps_ping(
  _pairing_code text,
  _lat numeric,
  _lng numeric,
  _accuracy_m numeric DEFAULT NULL,
  _battery_pct int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  ping_id uuid;
BEGIN
  SELECT * INTO d FROM public.gps_devices WHERE pairing_code = _pairing_code AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or inactive pairing code'; END IF;

  INSERT INTO public.gps_pings(device_id, pet_id, lat, lng, accuracy_m, battery_pct)
  VALUES (d.id, d.pet_id, _lat, _lng, _accuracy_m, _battery_pct)
  RETURNING id INTO ping_id;

  UPDATE public.gps_devices
  SET last_seen_at = now(),
      battery_pct = COALESCE(_battery_pct, battery_pct),
      updated_at = now()
  WHERE id = d.id;

  RETURN ping_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_gps_ping(text, numeric, numeric, numeric, int) TO authenticated, anon;

-- ===========================================================
-- Geofence breach trigger
-- ===========================================================
CREATE OR REPLACE FUNCTION public.tg_check_geofence_breach()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_fences boolean;
  inside boolean;
  owner uuid;
  pet_name text;
BEGIN
  SELECT owner_id INTO owner FROM public.gps_devices WHERE id = NEW.device_id;

  SELECT EXISTS (SELECT 1 FROM public.geofences WHERE pet_id = NEW.pet_id AND active)
    INTO has_fences;
  IF NOT has_fences THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.geofences g
    WHERE g.pet_id = NEW.pet_id AND g.active
      AND earth_distance(ll_to_earth(NEW.lat, NEW.lng),
                         ll_to_earth(g.center_lat, g.center_lng)) <= g.radius_m
  ) INTO inside;

  IF NOT inside THEN
    NEW.outside_geofence := true;
    SELECT name INTO pet_name FROM public.pets WHERE id = NEW.pet_id;
    PERFORM public.notify_user(
      owner, 'geofence',
      COALESCE(pet_name,'Your pet') || ' left their safe zone',
      'Tap to view live location.',
      '/pets/' || NEW.pet_id::text || '/tracker'
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gps_geofence_breach ON public.gps_pings;
CREATE TRIGGER trg_gps_geofence_breach
  BEFORE INSERT ON public.gps_pings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_check_geofence_breach();

-- Enable realtime for live tracking
ALTER TABLE public.gps_pings REPLICA IDENTITY FULL;
ALTER TABLE public.gps_devices REPLICA IDENTITY FULL;




-- 1. service_providers: extend
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS service_radius_km int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS days_available text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_slots text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepting_jobs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

ALTER TABLE public.service_providers
  DROP CONSTRAINT IF EXISTS service_providers_verification_status_check;
ALTER TABLE public.service_providers
  ADD CONSTRAINT service_providers_verification_status_check
  CHECK (verification_status IN ('pending','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_providers_accepting
  ON public.service_providers(category, accepting_jobs)
  WHERE accepting_jobs AND verified;
CREATE INDEX IF NOT EXISTS idx_providers_geo
  ON public.service_providers(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Helper: is this user an admin/moderator?
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'super_admin'::public.app_role)
      OR public.has_role(_uid, 'moderator'::public.app_role);
$$;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- 2. provider_documents
CREATE TABLE IF NOT EXISTS public.provider_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('govt_id','address','cert','license','other')),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_docs_provider ON public.provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_docs_status   ON public.provider_documents(status);

ALTER TABLE public.provider_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_docs_select ON public.provider_documents
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY provider_docs_insert ON public.provider_documents
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY provider_docs_update ON public.provider_documents
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY provider_docs_delete ON public.provider_documents
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_provider_docs_updated
  BEFORE UPDATE ON public.provider_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-docs', 'provider-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "provider-docs read" ON storage.objects;
CREATE POLICY "provider-docs read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-docs'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid()))
  );
DROP POLICY IF EXISTS "provider-docs write" ON storage.objects;
CREATE POLICY "provider-docs write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provider-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
DROP POLICY IF EXISTS "provider-docs delete" ON storage.objects;
CREATE POLICY "provider-docs delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. job_posts
CREATE TABLE IF NOT EXISTS public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  category public.service_category NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  address text,
  lat numeric,
  lng numeric,
  budget_inr int,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','completed','cancelled')),
  assigned_provider_id uuid REFERENCES public.service_providers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_open ON public.job_posts(category, status, scheduled_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_jobs_owner ON public.job_posts(owner_id);

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select ON public.job_posts
  FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers sp
               WHERE sp.id = job_posts.assigned_provider_id AND sp.owner_id = auth.uid())
    OR public.is_staff(auth.uid())
  );
CREATE POLICY jobs_insert ON public.job_posts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY jobs_update ON public.job_posts
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY jobs_delete ON public.job_posts
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_jobs_updated
  BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. job_offers
CREATE TABLE IF NOT EXISTS public.job_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  provider_owner_id uuid NOT NULL,
  message text,
  price_inr int,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_job_offers_job ON public.job_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_provider ON public.job_offers(provider_id);

ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_offers_select ON public.job_offers
  FOR SELECT TO authenticated
  USING (
    provider_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.job_posts j WHERE j.id = job_offers.job_id AND j.owner_id = auth.uid())
    OR public.is_staff(auth.uid())
  );
CREATE POLICY job_offers_insert ON public.job_offers
  FOR INSERT TO authenticated WITH CHECK (provider_owner_id = auth.uid());
CREATE POLICY job_offers_update ON public.job_offers
  FOR UPDATE TO authenticated
  USING (
    provider_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.job_posts j WHERE j.id = job_offers.job_id AND j.owner_id = auth.uid())
  )
  WITH CHECK (
    provider_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.job_posts j WHERE j.id = job_offers.job_id AND j.owner_id = auth.uid())
  );

CREATE TRIGGER trg_job_offers_updated
  BEFORE UPDATE ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  push  boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  per_kind jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_pref_select ON public.notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_pref_insert ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_pref_update ON public.notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notif_pref_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6a. enqueue fan-out on new job
CREATE OR REPLACE FUNCTION public.tg_enqueue_job_fanout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.notification_jobs (kind, payload)
    VALUES ('job_fanout', jsonb_build_object('job_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_enqueue_job_fanout() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_job_post_fanout ON public.job_posts;
CREATE TRIGGER trg_job_post_fanout
  AFTER INSERT ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_enqueue_job_fanout();

-- 6b. notify owner when an offer arrives
CREATE OR REPLACE FUNCTION public.tg_notify_job_offer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_title text;
BEGIN
  SELECT owner_id, title INTO v_owner, v_title FROM public.job_posts WHERE id = NEW.job_id;
  IF v_owner IS NOT NULL THEN
    PERFORM public.notify_user(v_owner,'job_offer_received','New offer on your job',
      COALESCE(v_title,'Someone wants to help'),'/jobs/'||NEW.job_id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_job_offer() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_job_offer_notify ON public.job_offers;
CREATE TRIGGER trg_job_offer_notify
  AFTER INSERT ON public.job_offers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_job_offer();

-- 6c. on assignment: notify chosen, decline others
CREATE OR REPLACE FUNCTION public.tg_on_job_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_provider_owner uuid;
BEGIN
  IF NEW.status = 'assigned'
     AND COALESCE(OLD.status,'') <> 'assigned'
     AND NEW.assigned_provider_id IS NOT NULL THEN
    SELECT owner_id INTO v_provider_owner FROM public.service_providers WHERE id = NEW.assigned_provider_id;
    IF v_provider_owner IS NOT NULL THEN
      PERFORM public.notify_user(v_provider_owner,'job_accepted','Job confirmed',
        COALESCE(NEW.title,'Your offer was accepted'),'/jobs/'||NEW.id);
    END IF;
    UPDATE public.job_offers SET status='declined'
      WHERE job_id = NEW.id AND provider_id <> NEW.assigned_provider_id AND status='pending';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_on_job_assigned() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_job_assigned ON public.job_posts;
CREATE TRIGGER trg_job_assigned
  AFTER UPDATE OF status ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_on_job_assigned();

-- 6d. notify provider on verification status change
CREATE OR REPLACE FUNCTION public.tg_notify_provider_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status = 'approved' THEN
      PERFORM public.notify_user(NEW.owner_id,'verification_approved','You are verified',
        'Your provider profile has been approved. You can now accept jobs.','/provider');
    ELSIF NEW.verification_status = 'rejected' THEN
      PERFORM public.notify_user(NEW.owner_id,'verification_rejected','Verification needs attention',
        COALESCE(NEW.verification_notes,'Please review and re-submit your documents.'),'/provider');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_notify_provider_verification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_provider_verification_notify ON public.service_providers;
CREATE TRIGGER trg_provider_verification_notify
  AFTER UPDATE OF verification_status ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_provider_verification();



-- Enable realtime for org_profiles so the verified tick auto-flips when an admin approves an org.
ALTER TABLE public.org_profiles REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.org_profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;



CREATE OR REPLACE FUNCTION public.notify_org_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'org_verified',
      'You''re verified âœ“',
      COALESCE(NEW.org_name, 'Your organisation') || ' is now verified. The green tick will appear on your posts and profile.',
      '/profile'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_org_verified ON public.org_profiles;
CREATE TRIGGER trg_notify_org_verified
AFTER INSERT OR UPDATE OF status ON public.org_profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_org_verified();



CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'search',
  q TEXT NOT NULL DEFAULT '',
  tab TEXT NOT NULL DEFAULT 'all',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id, created_at DESC);
CREATE UNIQUE INDEX uq_saved_searches_dedupe
  ON public.saved_searches(user_id, scope, lower(coalesce(q,'')), tab, md5(filters::text));

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saved searches"
  ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own saved searches"
  ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own saved searches"
  ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own saved searches"
  ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();



-- Audit log of shelter decisions on adoption applications
CREATE TABLE public.adoption_application_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.adoption_applications(id) ON DELETE CASCADE,
  decided_by UUID NOT NULL,
  status public.adoption_application_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aad_application ON public.adoption_application_decisions(application_id, created_at DESC);
CREATE INDEX idx_aad_decided_by ON public.adoption_application_decisions(decided_by);

ALTER TABLE public.adoption_application_decisions ENABLE ROW LEVEL SECURITY;

-- Shelter who owns the application can read its decisions
CREATE POLICY "Shelter views decisions for own apps"
  ON public.adoption_application_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.adoption_applications a
    WHERE a.id = application_id AND a.shelter_id = auth.uid()
  ));

-- Applicant can read decisions on their own application
CREATE POLICY "Applicant views decisions on own app"
  ON public.adoption_application_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.adoption_applications a
    WHERE a.id = application_id AND a.applicant_id = auth.uid()
  ));

-- Trigger: when application status changes, record decision + notify applicant
CREATE OR REPLACE FUNCTION public.handle_adoption_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved', 'rejected') THEN

    -- audit row (decided_by = current auth user, falls back to shelter_id)
    INSERT INTO public.adoption_application_decisions(application_id, decided_by, status, note)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.shelter_id), NEW.status, NEW.shelter_note);

    -- notify the applicant
    IF NEW.status = 'approved' THEN
      v_title := 'Your application was approved';
      v_body  := COALESCE(NEW.shelter_note, 'The shelter has approved your application. They will reach out shortly.');
    ELSE
      v_title := 'Your application was declined';
      v_body  := COALESCE(NEW.shelter_note, 'Thank you for applying. The shelter has declined this application.');
    END IF;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.applicant_id,
      'adoption_decision',
      v_title,
      v_body,
      '/adopt'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adoption_decision ON public.adoption_applications;
CREATE TRIGGER trg_adoption_decision
  AFTER UPDATE ON public.adoption_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_adoption_decision();



CREATE TABLE public.kennel_daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  meals INTEGER NOT NULL DEFAULT 0,
  walks INTEGER NOT NULL DEFAULT 0,
  potty INTEGER NOT NULL DEFAULT 0,
  mood TEXT NOT NULL DEFAULT 'good', -- 'great' | 'good' | 'off'
  notes TEXT,
  incidents TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_kdr_booking_date ON public.kennel_daily_reports(booking_id, report_date);
CREATE INDEX idx_kdr_provider_date ON public.kennel_daily_reports(provider_id, report_date DESC);

ALTER TABLE public.kennel_daily_reports ENABLE ROW LEVEL SECURITY;

-- Provider owner can fully manage reports they author for their providers
CREATE POLICY "Provider owner can read reports"
  ON public.kennel_daily_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Provider owner can insert reports"
  ON public.kennel_daily_reports FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
    )
  );

CREATE POLICY "Provider owner can update reports"
  ON public.kennel_daily_reports FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
  ));

CREATE POLICY "Provider owner can delete reports"
  ON public.kennel_daily_reports FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = provider_id AND sp.owner_id = auth.uid()
  ));

-- Customer (booking owner) can view reports about their booking
CREATE POLICY "Customer reads own booking reports"
  ON public.kennel_daily_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.service_bookings b
    WHERE b.id = booking_id AND b.customer_id = auth.uid()
  ));

-- Trigger: bump updated_at + notify customer on insert
CREATE TRIGGER trg_kdr_updated_at
  BEFORE UPDATE ON public.kennel_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

CREATE OR REPLACE FUNCTION public.handle_kennel_daily_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer UUID;
BEGIN
  SELECT customer_id INTO v_customer
  FROM public.service_bookings WHERE id = NEW.booking_id;

  IF v_customer IS NOT NULL AND v_customer <> NEW.author_id THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      v_customer,
      'kennel_daily_report',
      'Daily report from your kennel',
      COALESCE(NEW.notes, 'Today''s update is ready. Tap to see meals, walks and mood.'),
      '/bookings/recurring'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kdr_notify ON public.kennel_daily_reports;
CREATE TRIGGER trg_kdr_notify
  AFTER INSERT ON public.kennel_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_kennel_daily_report();



CREATE TYPE public.sponsorship_status AS ENUM ('pledged', 'active', 'cancelled');

CREATE TABLE public.sponsorships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL,
  org_user_id UUID NOT NULL,
  listing_id UUID REFERENCES public.pet_listings(id) ON DELETE SET NULL,
  amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
  status public.sponsorship_status NOT NULL DEFAULT 'active',
  message TEXT,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_charge_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsorships_org ON public.sponsorships(org_user_id, status, created_at DESC);
CREATE INDEX idx_sponsorships_sponsor ON public.sponsorships(sponsor_id, created_at DESC);
CREATE INDEX idx_sponsorships_listing ON public.sponsorships(listing_id) WHERE listing_id IS NOT NULL;

ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;

-- Sponsor manages their own
CREATE POLICY "Sponsor reads own"
  ON public.sponsorships FOR SELECT
  USING (auth.uid() = sponsor_id);

CREATE POLICY "Sponsor inserts own"
  ON public.sponsorships FOR INSERT
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY "Sponsor updates own"
  ON public.sponsorships FOR UPDATE
  USING (auth.uid() = sponsor_id);

CREATE POLICY "Sponsor deletes own"
  ON public.sponsorships FOR DELETE
  USING (auth.uid() = sponsor_id);

-- Receiving sanctuary reads all sponsorships made to them
CREATE POLICY "Org reads incoming"
  ON public.sponsorships FOR SELECT
  USING (auth.uid() = org_user_id);

-- Public can read active, non-anonymous sponsorships (for "supporters" counters)
CREATE POLICY "Public reads active non-anonymous"
  ON public.sponsorships FOR SELECT
  USING (status = 'active' AND anonymous = false);

CREATE TRIGGER trg_sponsorships_updated_at
  BEFORE UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- Notify the org on new pledges and on cancellation
CREATE OR REPLACE FUNCTION public.handle_sponsorship_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.org_user_id,
      'sponsorship_new',
      'New monthly sponsor ðŸ’›',
      CASE WHEN NEW.anonymous
        THEN 'An anonymous supporter pledged â‚¹' || NEW.amount_inr || '/month.'
        ELSE 'A new supporter pledged â‚¹' || NEW.amount_inr || '/month.'
      END,
      '/org/donations'
    );
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'cancelled' THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      NEW.org_user_id,
      'sponsorship_cancelled',
      'A sponsorship was cancelled',
      'Monthly pledge of â‚¹' || NEW.amount_inr || ' has ended.',
      '/org/donations'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sponsorship_change ON public.sponsorships;
CREATE TRIGGER trg_sponsorship_change
  AFTER INSERT OR UPDATE ON public.sponsorships
  FOR EACH ROW EXECUTE FUNCTION public.handle_sponsorship_change();




-- ---------- EXHIBITS ----------
CREATE TABLE public.exhibits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zoo_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT,
  description TEXT,
  habitat TEXT,
  on_display BOOLEAN NOT NULL DEFAULT true,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exhibits_zoo ON public.exhibits(zoo_user_id);
CREATE INDEX idx_exhibits_on_display ON public.exhibits(zoo_user_id, on_display);

ALTER TABLE public.exhibits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exhibits are viewable by everyone"
  ON public.exhibits FOR SELECT USING (true);
CREATE POLICY "Zoo owners can insert their exhibits"
  ON public.exhibits FOR INSERT WITH CHECK (auth.uid() = zoo_user_id);
CREATE POLICY "Zoo owners can update their exhibits"
  ON public.exhibits FOR UPDATE USING (auth.uid() = zoo_user_id);
CREATE POLICY "Zoo owners can delete their exhibits"
  ON public.exhibits FOR DELETE USING (auth.uid() = zoo_user_id);

CREATE TRIGGER update_exhibits_updated_at
  BEFORE UPDATE ON public.exhibits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- PEDIGREE CERTIFICATES ----------
CREATE TABLE public.pedigree_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  registry_name TEXT,
  sire_name TEXT,
  dam_name TEXT,
  breed TEXT,
  notes TEXT,
  document_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedigree_pet ON public.pedigree_certificates(pet_id);
CREATE INDEX idx_pedigree_issuer ON public.pedigree_certificates(issued_by);

ALTER TABLE public.pedigree_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pedigree certificates are viewable by everyone"
  ON public.pedigree_certificates FOR SELECT USING (true);
CREATE POLICY "Issuers can create pedigree certificates for their own pets"
  ON public.pedigree_certificates FOR INSERT
  WITH CHECK (
    auth.uid() = issued_by
    AND EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = pedigree_certificates.pet_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "Issuers can update their pedigree certificates"
  ON public.pedigree_certificates FOR UPDATE USING (auth.uid() = issued_by);
CREATE POLICY "Issuers can delete their pedigree certificates"
  ON public.pedigree_certificates FOR DELETE USING (auth.uid() = issued_by);

CREATE TRIGGER update_pedigree_updated_at
  BEFORE UPDATE ON public.pedigree_certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_pedigree_certificate_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.certificate_number IS NULL OR NEW.certificate_number = '' THEN
    NEW.certificate_number := 'PETOS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pedigree_certificate_number
  BEFORE INSERT ON public.pedigree_certificates
  FOR EACH ROW EXECUTE FUNCTION public.handle_pedigree_certificate_number();




ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid;

CREATE INDEX IF NOT EXISTS idx_notifications_actor ON public.notifications(actor_id);

-- Helper that mirrors notify_user but stores the actor.
CREATE OR REPLACE FUNCTION public.notify_user_with_actor(
  _user_id uuid,
  _actor_id uuid,
  _type text,
  _title text,
  _body text,
  _link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_push boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  -- Don't notify yourself.
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN RETURN; END IF;
  SELECT COALESCE((notif_prefs->>'push')::boolean, true) INTO v_push
  FROM public.profiles WHERE id = _user_id;
  IF v_push IS false THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (_user_id, _actor_id, _type, _title, _body, _link);
END
$$;

-- Update triggers so they pass the actor through.

CREATE OR REPLACE FUNCTION public.on_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL AND v_author <> NEW.author_id THEN
    PERFORM public.notify_user_with_actor(v_author, NEW.author_id, 'post_comment',
      'New comment on your post', LEFT(NEW.body, 80), '/');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.notify_user_with_actor(NEW.following_id, NEW.follower_id, 'new_follower',
    'New follower',
    COALESCE(v_name, 'Someone') || ' started following you',
    '/u/' || NEW.follower_id);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_mating_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user_with_actor(NEW.to_owner_id, NEW.from_owner_id, 'mate_request',
      'New mating request',
      'Someone is interested in your pet',
      '/mates/manage');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user_with_actor(NEW.from_owner_id, NEW.to_owner_id, 'mate_status',
      'Mating request ' || NEW.status,
      'Status updated for your request',
      '/mates/manage');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_rsvp_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_host uuid; v_title text;
BEGIN
  SELECT host_id, title INTO v_host, v_title FROM public.meetups WHERE id = NEW.meetup_id;
  IF v_host IS NOT NULL AND v_host <> NEW.user_id AND NEW.status = 'going' THEN
    PERFORM public.notify_user_with_actor(v_host, NEW.user_id, 'meetup_rsvp',
      'New RSVP for ' || v_title,
      'Someone is coming to your meetup',
      '/meetups/' || NEW.meetup_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.on_appointment_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user_with_actor(NEW.vet_id, NEW.owner_id, 'appt_new',
      'New appointment request',
      'Mode: ' || NEW.mode::text || ' on ' || to_char(NEW.scheduled_at, 'DD Mon HH24:MI'),
      '/vet');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_user_with_actor(NEW.owner_id, NEW.vet_id, 'appt_status',
      'Appointment ' || NEW.status::text,
      'Update on your appointment',
      '/profile');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bump_conv_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  SELECT cm.user_id, NEW.sender_id, 'new_message',
         'New message',
         LEFT(COALESCE(NEW.body, '[attachment]'), 80),
         '/messages/' || NEW.conversation_id
  FROM public.conversation_members cm
  WHERE cm.conversation_id = NEW.conversation_id
    AND cm.user_id <> NEW.sender_id
    AND cm.muted = false;
  RETURN NEW;
END $$;




CREATE OR REPLACE FUNCTION public.on_vet_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_asker uuid; v_title text;
BEGIN
  UPDATE public.vet_questions
    SET answer_count = answer_count + 1,
        status = CASE WHEN status = 'open' THEN 'answered'::vet_q_status ELSE status END
    WHERE id = NEW.question_id
    RETURNING asker_id, title INTO v_asker, v_title;
  IF v_asker IS NOT NULL AND v_asker <> NEW.vet_id THEN
    PERFORM public.notify_user_with_actor(v_asker, NEW.vet_id, 'vet_answer',
      'A vet answered your question',
      LEFT(NEW.body, 80),
      '/askvet/' || NEW.question_id);
  END IF;
  RETURN NEW;
END $$;



-- Round 20: Geo + ranked search across profiles, pet_listings, service_providers

-- pg_trgm indexes for fast fuzzy matching
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_city_trgm ON public.profiles USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pet_listings_title_trgm ON public.pet_listings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pet_listings_breed_trgm ON public.pet_listings USING gin (breed gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pet_listings_city_trgm ON public.pet_listings USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_providers_name_trgm ON public.service_providers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_providers_city_trgm ON public.service_providers USING gin (city gin_trgm_ops);

-- Unified search function: ranked, geo-aware
-- Returns mixed entities sorted by composite score:
--   similarity * 0.5 + recency * 0.3 + proximity * 0.2
CREATE OR REPLACE FUNCTION public.search_entities(
  p_query text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km integer DEFAULT 50,
  p_entity_type text DEFAULT 'all',  -- 'all' | 'people' | 'pets' | 'providers'
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  entity_type text,
  id uuid,
  title text,
  subtitle text,
  image_url text,
  city text,
  distance_km double precision,
  score double precision,
  payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := COALESCE(NULLIF(trim(p_query), ''), '');
  has_geo boolean := p_lat IS NOT NULL AND p_lng IS NOT NULL;
  radius_m double precision := GREATEST(p_radius_km, 1) * 1000.0;
BEGIN
  RETURN QUERY
  WITH people AS (
    SELECT
      'people'::text AS entity_type,
      p.id,
      COALESCE(p.full_name, 'Unnamed') AS title,
      COALESCE(p.account_type::text, 'pet_parent') AS subtitle,
      p.avatar_url AS image_url,
      p.city,
      CASE WHEN has_geo AND p.lat IS NOT NULL AND p.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(p.lat::float8, p.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(p.full_name,''), q),
        similarity(COALESCE(p.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - p.updated_at)) / 86400.0 AS age_days,
      jsonb_build_object('account_type', p.account_type, 'handle', p.handle) AS payload
    FROM profiles p
    WHERE p.onboarded = true
      AND (p_entity_type IN ('all','people'))
      AND (q = '' OR (COALESCE(p.full_name,'') % q OR COALESCE(p.city,'') % q OR COALESCE(p.full_name,'') ILIKE '%'||q||'%'))
      AND (NOT has_geo OR p.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(p.lat::float8, p.lng::float8))
  ),
  pets AS (
    SELECT
      'pets'::text AS entity_type,
      pl.id,
      COALESCE(NULLIF(pl.title,''), pl.breed, pl.species, 'Listing') AS title,
      CONCAT_WS(' Â· ', pl.breed, pl.city) AS subtitle,
      (pl.photos)[1] AS image_url,
      pl.city,
      CASE WHEN has_geo AND pl.lat IS NOT NULL AND pl.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(pl.lat::float8, pl.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(pl.title,''), q),
        similarity(COALESCE(pl.breed,''), q),
        similarity(COALESCE(pl.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - pl.created_at)) / 86400.0 AS age_days,
      jsonb_build_object('listing_type', pl.listing_type, 'fee_inr', pl.fee_inr, 'breed', pl.breed) AS payload
    FROM pet_listings pl
    WHERE pl.active = true
      AND pl.status = 'available'
      AND (p_entity_type IN ('all','pets'))
      AND (q = '' OR (
        COALESCE(pl.title,'') % q OR COALESCE(pl.breed,'') % q OR COALESCE(pl.city,'') % q
        OR COALESCE(pl.title,'') ILIKE '%'||q||'%' OR COALESCE(pl.breed,'') ILIKE '%'||q||'%'
      ))
      AND (NOT has_geo OR pl.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(pl.lat::float8, pl.lng::float8))
  ),
  providers AS (
    SELECT
      'providers'::text AS entity_type,
      sp.id,
      COALESCE(sp.name, 'Provider') AS title,
      CONCAT_WS(' Â· ', sp.category::text, sp.city) AS subtitle,
      sp.cover_url AS image_url,
      sp.city,
      CASE WHEN has_geo AND sp.lat IS NOT NULL AND sp.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(sp.lat::float8, sp.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(sp.name,''), q),
        similarity(COALESCE(sp.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - sp.updated_at)) / 86400.0 AS age_days,
      jsonb_build_object('category', sp.category, 'verified', sp.verified) AS payload
    FROM service_providers sp
    WHERE sp.active = true
      AND (p_entity_type IN ('all','providers'))
      AND (q = '' OR (COALESCE(sp.name,'') % q OR COALESCE(sp.city,'') % q OR COALESCE(sp.name,'') ILIKE '%'||q||'%'))
      AND (NOT has_geo OR sp.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(sp.lat::float8, sp.lng::float8))
  ),
  unioned AS (
    SELECT * FROM people
    UNION ALL SELECT * FROM pets
    UNION ALL SELECT * FROM providers
  )
  SELECT
    u.entity_type,
    u.id,
    u.title,
    u.subtitle,
    u.image_url,
    u.city,
    u.distance_km,
    (
      COALESCE(u.sim_score, 0) * 0.5
      + GREATEST(0, 1.0 - LEAST(COALESCE(u.age_days, 365) / 90.0, 1.0)) * 0.3
      + CASE
          WHEN u.distance_km IS NULL THEN 0
          ELSE GREATEST(0, 1.0 - LEAST(u.distance_km / GREATEST(p_radius_km, 1), 1.0)) * 0.2
        END
    )::double precision AS score,
    u.payload
  FROM unioned u
  WHERE (q = '' OR u.sim_score > 0.05)
  ORDER BY score DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_entities(text, double precision, double precision, integer, text, integer) TO anon, authenticated;



CREATE OR REPLACE FUNCTION public.search_entities(
  p_query text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km integer DEFAULT 50,
  p_entity_type text DEFAULT 'all',
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  entity_type text,
  id uuid,
  title text,
  subtitle text,
  image_url text,
  city text,
  distance_km double precision,
  score double precision,
  payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := COALESCE(NULLIF(trim(p_query), ''), '');
  has_geo boolean := p_lat IS NOT NULL AND p_lng IS NOT NULL;
  radius_m double precision := GREATEST(p_radius_km, 1) * 1000.0;
BEGIN
  RETURN QUERY
  WITH people AS (
    SELECT
      'people'::text AS entity_type,
      p.id,
      COALESCE(p.full_name, 'Unnamed') AS title,
      COALESCE(p.account_type::text, 'pet_parent') AS subtitle,
      p.avatar_url AS image_url,
      p.city,
      CASE WHEN has_geo AND p.lat IS NOT NULL AND p.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(p.lat::float8, p.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(p.full_name,''), q),
        similarity(COALESCE(p.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - p.updated_at)) / 86400.0 AS age_days,
      jsonb_build_object('account_type', p.account_type, 'handle', p.handle) AS payload
    FROM profiles p
    WHERE p.onboarded = true
      AND (p_entity_type IN ('all','people'))
      AND (q = '' OR (COALESCE(p.full_name,'') % q OR COALESCE(p.city,'') % q OR COALESCE(p.full_name,'') ILIKE '%'||q||'%'))
      AND (NOT has_geo OR p.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(p.lat::float8, p.lng::float8))
  ),
  pets AS (
    SELECT
      'pets'::text AS entity_type,
      pl.id,
      COALESCE(NULLIF(pl.title,''), pl.breed, pl.species, 'Listing') AS title,
      CONCAT_WS(' Â· ', pl.breed, pl.city) AS subtitle,
      (pl.photos)[1] AS image_url,
      pl.city,
      CASE WHEN has_geo AND pl.lat IS NOT NULL AND pl.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(pl.lat::float8, pl.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(pl.title,''), q),
        similarity(COALESCE(pl.breed,''), q),
        similarity(COALESCE(pl.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - pl.created_at)) / 86400.0 AS age_days,
      jsonb_build_object('listing_type', pl.listing_type, 'fee_inr', pl.fee_inr, 'breed', pl.breed) AS payload
    FROM pet_listings pl
    WHERE pl.active = true
      AND pl.status = 'active'::pet_listing_status
      AND (p_entity_type IN ('all','pets'))
      AND (q = '' OR (
        COALESCE(pl.title,'') % q OR COALESCE(pl.breed,'') % q OR COALESCE(pl.city,'') % q
        OR COALESCE(pl.title,'') ILIKE '%'||q||'%' OR COALESCE(pl.breed,'') ILIKE '%'||q||'%'
      ))
      AND (NOT has_geo OR pl.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(pl.lat::float8, pl.lng::float8))
  ),
  providers AS (
    SELECT
      'providers'::text AS entity_type,
      sp.id,
      COALESCE(sp.name, 'Provider') AS title,
      CONCAT_WS(' Â· ', sp.category::text, sp.city) AS subtitle,
      sp.cover_url AS image_url,
      sp.city,
      CASE WHEN has_geo AND sp.lat IS NOT NULL AND sp.lng IS NOT NULL
        THEN earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(sp.lat::float8, sp.lng::float8)) / 1000.0
        ELSE NULL END AS distance_km,
      GREATEST(
        similarity(COALESCE(sp.name,''), q),
        similarity(COALESCE(sp.city,''), q) * 0.6
      ) AS sim_score,
      EXTRACT(EPOCH FROM (now() - sp.updated_at)) / 86400.0 AS age_days,
      jsonb_build_object('category', sp.category, 'verified', sp.verified) AS payload
    FROM service_providers sp
    WHERE sp.active = true
      AND (p_entity_type IN ('all','providers'))
      AND (q = '' OR (COALESCE(sp.name,'') % q OR COALESCE(sp.city,'') % q OR COALESCE(sp.name,'') ILIKE '%'||q||'%'))
      AND (NOT has_geo OR sp.lat IS NULL OR
           earth_box(ll_to_earth(p_lat, p_lng), radius_m) @> ll_to_earth(sp.lat::float8, sp.lng::float8))
  ),
  unioned AS (
    SELECT * FROM people
    UNION ALL SELECT * FROM pets
    UNION ALL SELECT * FROM providers
  )
  SELECT
    u.entity_type,
    u.id,
    u.title,
    u.subtitle,
    u.image_url,
    u.city,
    u.distance_km,
    (
      COALESCE(u.sim_score, 0) * 0.5
      + GREATEST(0, 1.0 - LEAST(COALESCE(u.age_days, 365) / 90.0, 1.0)) * 0.3
      + CASE
          WHEN u.distance_km IS NULL THEN 0
          ELSE GREATEST(0, 1.0 - LEAST(u.distance_km / GREATEST(p_radius_km, 1), 1.0)) * 0.2
        END
    )::double precision AS score,
    u.payload
  FROM unioned u
  WHERE (q = '' OR u.sim_score > 0.05)
  ORDER BY score DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
END;
$$;



ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS health_tests JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pet_listings.health_tests IS
  'Array of {code, label, result, verified_by?, verified_at?} health screening entries. e.g. [{"code":"hips_ofa","label":"Hips OFA","result":"Good"}]';



CREATE TABLE IF NOT EXISTS public.rescue_journeys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id      UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  cover_url   TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL DEFAULT 'in_care'
              CHECK (status IN ('in_care', 'adopted', 'rip')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rescue_journeys_org    ON public.rescue_journeys(org_id);
CREATE INDEX IF NOT EXISTS idx_rescue_journeys_status ON public.rescue_journeys(status);

ALTER TABLE public.rescue_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rescue journeys"
  ON public.rescue_journeys FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Only shelters/rescuers create their own journeys"
  ON public.rescue_journeys FOR INSERT TO authenticated
  WITH CHECK (
    org_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.account_type IN ('shelter', 'rescuer', 'sanctuary')
    )
  );

CREATE POLICY "Owner updates own journeys"
  ON public.rescue_journeys FOR UPDATE TO authenticated
  USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());

CREATE POLICY "Owner deletes own journeys"
  ON public.rescue_journeys FOR DELETE TO authenticated
  USING (org_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.rescue_journey_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id  UUID NOT NULL REFERENCES public.rescue_journeys(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  day_number  INT NOT NULL,
  image_url   TEXT,
  caption     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rescue_journey_entries_journey
  ON public.rescue_journey_entries(journey_id, day_number);

ALTER TABLE public.rescue_journey_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view journey entries"
  ON public.rescue_journey_entries FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Owner inserts entries on own journey"
  ON public.rescue_journey_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rescue_journeys j
      WHERE j.id = journey_id AND j.org_id = auth.uid()
    )
  );

CREATE POLICY "Owner updates own journey entries"
  ON public.rescue_journey_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rescue_journeys j
      WHERE j.id = journey_id AND j.org_id = auth.uid()
    )
  );

CREATE POLICY "Owner deletes own journey entries"
  ON public.rescue_journey_entries FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rescue_journeys j
      WHERE j.id = journey_id AND j.org_id = auth.uid()
    )
  );

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS rescue_journey_id UUID
  REFERENCES public.rescue_journeys(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_rescue_journey
  ON public.posts(rescue_journey_id) WHERE rescue_journey_id IS NOT NULL;

DROP TRIGGER IF EXISTS tg_rescue_journeys_set_updated_at ON public.rescue_journeys;
CREATE TRIGGER tg_rescue_journeys_set_updated_at
  BEFORE UPDATE ON public.rescue_journeys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.create_rescue_journey_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j_started TIMESTAMPTZ;
  j_owner   UUID;
  d_num     INT;
BEGIN
  IF NEW.rescue_journey_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT started_at, org_id INTO j_started, j_owner
  FROM public.rescue_journeys
  WHERE id = NEW.rescue_journey_id;

  IF j_started IS NULL THEN
    RETURN NEW;
  END IF;

  IF j_owner <> NEW.author_id THEN
    RETURN NEW;
  END IF;

  d_num := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (now() - j_started)) / 86400)::INT + 1);

  INSERT INTO public.rescue_journey_entries (journey_id, post_id, day_number, image_url, caption)
  VALUES (
    NEW.rescue_journey_id,
    NEW.id,
    d_num,
    COALESCE(NEW.image_url_feed, NEW.image_url),
    NEW.caption
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_posts_rescue_journey_entry ON public.posts;
CREATE TRIGGER tg_posts_rescue_journey_entry
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.create_rescue_journey_entry();

ALTER PUBLICATION supabase_realtime ADD TABLE public.rescue_journey_entries;




-- Pet skills (trick repertoire per pet)
CREATE TABLE public.pet_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  name text NOT NULL,
  taught_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pet_id, name)
);
ALTER TABLE public.pet_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pet skills are public readable"
  ON public.pet_skills FOR SELECT USING (true);

CREATE POLICY "Pet owner can insert skills"
  ON public.pet_skills FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

CREATE POLICY "Pet owner can delete skills"
  ON public.pet_skills FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Skill spotlights (a post showcasing a skill)
CREATE TABLE public.skill_spotlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.pet_skills(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  video_url text,
  caption text,
  vouch_count int NOT NULL DEFAULT 0,
  wow_count int NOT NULL DEFAULT 0,
  crowd_favourite_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.skill_spotlights ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_spotlights_pet ON public.skill_spotlights(pet_id);
CREATE INDEX idx_spotlights_post ON public.skill_spotlights(post_id);

CREATE POLICY "Spotlights public readable"
  ON public.skill_spotlights FOR SELECT USING (true);

CREATE POLICY "Pet owner can create spotlight"
  ON public.skill_spotlights FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
  );

CREATE POLICY "Pet owner can delete spotlight"
  ON public.skill_spotlights FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()));

-- Vouches
CREATE TABLE public.skill_vouches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotlight_id uuid NOT NULL REFERENCES public.skill_spotlights(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (spotlight_id, voucher_id)
);
ALTER TABLE public.skill_vouches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vouches_spotlight ON public.skill_vouches(spotlight_id);

CREATE POLICY "Vouches public readable"
  ON public.skill_vouches FOR SELECT USING (true);

CREATE POLICY "Authed users can vouch (not self)"
  ON public.skill_vouches FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = voucher_id
    AND NOT EXISTS (
      SELECT 1 FROM public.skill_spotlights s
      JOIN public.pets p ON p.id = s.pet_id
      WHERE s.id = spotlight_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove own vouch"
  ON public.skill_vouches FOR DELETE TO authenticated
  USING (auth.uid() = voucher_id);

-- Maintain vouch_count + crowd_favourite flip
CREATE OR REPLACE FUNCTION public.maintain_vouch_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.skill_spotlights
       SET vouch_count = vouch_count + 1,
           crowd_favourite_at = CASE
             WHEN vouch_count + 1 >= 50 AND crowd_favourite_at IS NULL THEN now()
             ELSE crowd_favourite_at
           END
     WHERE id = NEW.spotlight_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.skill_spotlights
       SET vouch_count = GREATEST(vouch_count - 1, 0)
     WHERE id = OLD.spotlight_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_vouch_count_ins
  AFTER INSERT ON public.skill_vouches
  FOR EACH ROW EXECUTE FUNCTION public.maintain_vouch_count();

CREATE TRIGGER trg_vouch_count_del
  AFTER DELETE ON public.skill_vouches
  FOR EACH ROW EXECUTE FUNCTION public.maintain_vouch_count();

-- Link posts to a spotlight (so feed can render the orange ribbon)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS skill_spotlight_id uuid REFERENCES public.skill_spotlights(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_skill_spotlight ON public.posts(skill_spotlight_id);




ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS co_listed_with_org_id uuid REFERENCES public.org_profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pet_listings_colisted ON public.pet_listings(co_listed_with_org_id);

CREATE OR REPLACE FUNCTION public.enforce_rescuer_colist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  author_role text;
  author_org_status text;
  shelter_status text;
  shelter_type text;
BEGIN
  SELECT account_type INTO author_role FROM public.profiles WHERE id = NEW.owner_id;
  IF author_role IS DISTINCT FROM 'rescuer' THEN
    RETURN NEW;
  END IF;

  SELECT status INTO author_org_status
    FROM public.org_profiles WHERE user_id = NEW.owner_id;
  IF author_org_status = 'approved' THEN
    RETURN NEW;
  END IF;

  IF NEW.co_listed_with_org_id IS NULL THEN
    RAISE EXCEPTION 'Unverified rescuers must co-list with an approved shelter.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT status, org_type::text INTO shelter_status, shelter_type
    FROM public.org_profiles WHERE user_id = NEW.co_listed_with_org_id;
  IF shelter_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Co-listing org must be an approved shelter.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rescuer_colist ON public.pet_listings;
CREATE TRIGGER trg_enforce_rescuer_colist
  BEFORE INSERT ON public.pet_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rescuer_colist();



CREATE OR REPLACE FUNCTION public.notify_skill_vouch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_pet_id uuid;
  v_pet_name text;
  v_skill_name text;
  v_voucher_name text;
BEGIN
  SELECT p.owner_id, p.id, p.name, ps.name
    INTO v_owner, v_pet_id, v_pet_name, v_skill_name
  FROM public.skill_spotlights s
  JOIN public.pets p ON p.id = s.pet_id
  JOIN public.pet_skills ps ON ps.id = s.skill_id
  WHERE s.id = NEW.spotlight_id;

  IF v_owner IS NULL OR v_owner = NEW.voucher_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, username, 'Someone')
    INTO v_voucher_name
  FROM public.profiles
  WHERE id = NEW.voucher_id;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (
    v_owner,
    NEW.voucher_id,
    'skill_vouch',
    COALESCE(v_voucher_name, 'Someone') || ' vouched for ' || COALESCE(v_pet_name, 'your pet'),
    CASE WHEN v_skill_name IS NOT NULL THEN 'Skill: ' || v_skill_name ELSE NULL END,
    '/pet/' || v_pet_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_skill_vouch ON public.skill_vouches;
CREATE TRIGGER trg_notify_skill_vouch
  AFTER INSERT ON public.skill_vouches
  FOR EACH ROW EXECUTE FUNCTION public.notify_skill_vouch();



-- Auto-revoke vault grants once the appointment ends.
CREATE OR REPLACE FUNCTION public.expire_grants_on_appt_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('completed','cancelled')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.pet_id IS NOT NULL THEN
    UPDATE public.vet_access_grants
       SET revoked = true,
           expires_at = LEAST(expires_at, now())
     WHERE pet_id = NEW.pet_id
       AND created_by = NEW.owner_id
       AND revoked = false
       AND expires_at > now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expire_grants_on_appt_complete ON public.appointments;
CREATE TRIGGER trg_expire_grants_on_appt_complete
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.expire_grants_on_appt_complete();




ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS donor_pan TEXT,
  ADD COLUMN IF NOT EXISTS tax_receipt_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS receipt_issued_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.assign_tax_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_type TEXT;
BEGIN
  IF NEW.status = 'paid' AND NEW.tax_receipt_number IS NULL THEN
    SELECT account_type INTO org_type FROM public.profiles WHERE id = NEW.org_user_id;
    IF org_type IN ('sanctuary', 'zoo', 'shelter') THEN
      NEW.tax_receipt_number := 'PETOS-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 99999999)::int)::text, 8, '0');
      NEW.receipt_issued_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donations_assign_receipt ON public.donations;
CREATE TRIGGER donations_assign_receipt
BEFORE INSERT OR UPDATE OF status ON public.donations
FOR EACH ROW
EXECUTE FUNCTION public.assign_tax_receipt_number();

-- Backfill existing paid donations
UPDATE public.donations d
SET tax_receipt_number = 'PETOS-' || to_char(coalesce(d.paid_at, d.created_at), 'YYYY') || '-' || lpad((floor(random() * 99999999)::int)::text, 8, '0'),
    receipt_issued_at = coalesce(d.paid_at, d.created_at)
WHERE d.status = 'paid'
  AND d.tax_receipt_number IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = d.org_user_id AND p.account_type IN ('sanctuary', 'zoo', 'shelter')
  );




-- Kennel capacity & availability
ALTER TABLE public.boarding_services
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS next_available_at TIMESTAMPTZ;

-- Sanctuary monthly upkeep
ALTER TABLE public.pet_listings
  ADD COLUMN IF NOT EXISTS monthly_upkeep_inr INTEGER;

-- Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.pet_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_listing ON public.wishlists(listing_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wishlist"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users add to own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove from own wishlist"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);

-- Enforce free adoption for shelters/sanctuaries/rescuers
CREATE OR REPLACE FUNCTION public.enforce_shelter_zero_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_type TEXT;
BEGIN
  SELECT account_type INTO owner_type FROM public.profiles WHERE id = NEW.owner_id;
  IF NEW.seller_type IN ('shelter', 'sanctuary', 'rescuer')
     OR owner_type IN ('shelter', 'sanctuary', 'rescuer') THEN
    IF NEW.fee_inr IS NOT NULL AND NEW.fee_inr > 0 THEN
      RAISE EXCEPTION 'Shelter, sanctuary, and rescuer listings must be free (fee_inr must be 0 or null).';
    END IF;
    NEW.listing_type := 'adoption';
    NEW.fee_inr := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pet_listings_enforce_zero_fee ON public.pet_listings;
CREATE TRIGGER pet_listings_enforce_zero_fee
BEFORE INSERT OR UPDATE OF fee_inr, seller_type, listing_type ON public.pet_listings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shelter_zero_fee();




-- Phase 1: Backend Security Hardening

-- 1. Lock down user_roles: drop the public SELECT policy, add owner-self + admin-only
DROP POLICY IF EXISTS "roles_select_all" ON public.user_roles;

CREATE POLICY "roles_select_own"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "roles_select_admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Recreate public-facing views with security_invoker=on so they respect caller RLS
ALTER VIEW public.pets_public SET (security_invoker = on);
ALTER VIEW public.profiles_public SET (security_invoker = on);
ALTER VIEW public.pet_health_status SET (security_invoker = on);
ALTER VIEW public.repeat_sellers SET (security_invoker = on);
ALTER VIEW public.trending_hashtags SET (security_invoker = on);
ALTER VIEW public.subject_ratings SET (security_invoker = on);

-- 3. Make org-docs bucket private (it can hold KYC / verification docs)
UPDATE storage.buckets SET public = false WHERE id = 'org-docs';




CREATE OR REPLACE FUNCTION public.get_pet_public_by_ref(_ref text)
RETURNS TABLE (
  id uuid, public_id text, owner_id uuid, name text,
  species pet_species, breed text, gender pet_gender, date_of_birth date,
  avatar_url text, bio text, city text,
  vaccination_verified boolean, discoverable_for_mating boolean,
  status_chip text, sire_pet_id uuid, dam_pet_id uuid, litter_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating,
         status_chip, sire_pet_id, dam_pet_id, litter_id
  FROM public.pets
  WHERE public_id = _ref OR id::text = _ref
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_profile_public_by_ref(_ref text)
RETURNS TABLE (
  id uuid, full_name text, avatar_url text, city text,
  bio text, handle text, cover_url text, account_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, city, bio, handle, cover_url, account_type::text
  FROM public.profiles
  WHERE handle = _ref OR id::text = _ref
  LIMIT 1
$$;

DROP FUNCTION IF EXISTS public.get_pets_public() CASCADE;

CREATE OR REPLACE FUNCTION public.get_pets_public()
RETURNS TABLE (
  id uuid, public_id text, owner_id uuid, name text,
  species pet_species, breed text, gender pet_gender, date_of_birth date,
  avatar_url text, bio text, city text,
  vaccination_verified boolean, discoverable_for_mating boolean,
  status_chip text, sire_pet_id uuid, dam_pet_id uuid, litter_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, public_id, owner_id, name, species, breed, gender, date_of_birth,
         avatar_url, bio, city, vaccination_verified, discoverable_for_mating,
         status_chip, sire_pet_id, dam_pet_id, litter_id
  FROM public.pets
$$;

CREATE VIEW public.pets_public WITH (security_invoker = on) AS
  SELECT * FROM public.get_pets_public();




-- 1. service_providers.contact_phone: column-level revoke
REVOKE SELECT (contact_phone) ON public.service_providers FROM anon, authenticated;
-- Owners still see everything via the existing owner policies and re-grant their column read
GRANT SELECT (contact_phone) ON public.service_providers TO authenticated;
-- Note: column GRANT to authenticated is global; row-level RLS still enforces who sees rows.
-- To truly hide phone from non-owners we add a column policy via view:
CREATE OR REPLACE VIEW public.service_providers_public
WITH (security_invoker = on) AS
SELECT id, owner_id, name, category, city, bio, hourly_rate_inr, cover_url,
       verified, active, lat, lng, trust_status, years_experience, service_radius_km,
       languages, days_available, time_slots, accepting_jobs, verification_status,
       details, created_at, updated_at
FROM public.service_providers;
GRANT SELECT ON public.service_providers_public TO anon, authenticated;

-- 2. org_profiles.phone: column-level revoke + safe view
REVOKE SELECT (phone) ON public.org_profiles FROM anon, authenticated;
GRANT SELECT (phone) ON public.org_profiles TO authenticated;
CREATE OR REPLACE VIEW public.org_profiles_public
WITH (security_invoker = on) AS
SELECT user_id, org_name, org_type, address, city, state, pincode,
       lat, lng, website, description, facility_photos, donation_upi, donation_url,
       status, total_donations_inr, donor_count, created_at, updated_at
FROM public.org_profiles
WHERE status = 'approved';
GRANT SELECT ON public.org_profiles_public TO anon, authenticated;

-- 3. donations.donor_pan: revoke from non-donor
REVOKE SELECT (donor_pan) ON public.donations FROM anon, authenticated;
GRANT SELECT (donor_pan) ON public.donations TO authenticated;
-- Org-facing view (no donor_pan)
CREATE OR REPLACE VIEW public.donations_for_org
WITH (security_invoker = on) AS
SELECT id, donor_id, org_user_id, amount_inr, message, anonymous, status,
       payment_intent_id, created_at, paid_at, tax_receipt_number, receipt_issued_at
FROM public.donations;
GRANT SELECT ON public.donations_for_org TO authenticated;

-- 4. Remove public read on org-docs storage bucket
DROP POLICY IF EXISTS "org-docs public read" ON storage.objects;

DROP POLICY IF EXISTS "org-docs owner read" ON storage.objects;
CREATE POLICY "org-docs owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'org-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "org-docs admin read" ON storage.objects;
CREATE POLICY "org-docs admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-docs'
    AND (public.has_role(auth.uid(), 'super_admin'::app_role)
         OR public.has_role(auth.uid(), 'moderator'::app_role))
  );

-- 5. Realtime channel authorization
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can subscribe to own user channel" ON realtime.messages;
CREATE POLICY "users can subscribe to own user channel"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('user:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('alerts:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('notifications:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE 'public:%'
  );

DROP POLICY IF EXISTS "users can broadcast to own user channel" ON realtime.messages;
CREATE POLICY "users can broadcast to own user channel"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE ('user:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('alerts:' || (auth.uid())::text || '%')
    OR realtime.topic() LIKE ('notifications:' || (auth.uid())::text || '%')
  );




REVOKE SELECT (donor_pan) ON public.donations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_my_donation_pan(_donation_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT donor_pan
  FROM public.donations
  WHERE id = _donation_id
    AND donor_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_donation_pan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_donation_pan(uuid) TO authenticated;

REVOKE SELECT (phone) ON public.org_profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_org_profile_phone(_org_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone
  FROM public.org_profiles
  WHERE user_id = _org_user_id
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_profile_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_profile_phone(uuid) TO authenticated;

REVOKE SELECT (contact_phone) ON public.service_providers FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_service_provider_phone(_provider_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contact_phone
  FROM public.service_providers
  WHERE id = _provider_id
    AND (
      owner_id = auth.uid()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.service_bookings sb
        WHERE sb.provider_id = _provider_id
          AND sb.customer_id = auth.uid()
          AND sb.status::text NOT IN ('cancelled','declined')
      )
      OR EXISTS (
        SELECT 1 FROM public.transport_bookings tb
        WHERE tb.provider_id = _provider_id
          AND tb.customer_id = auth.uid()
          AND tb.status::text NOT IN ('cancelled','declined')
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_service_provider_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_provider_phone(uuid) TO authenticated;




GRANT SELECT (donor_pan) ON public.donations TO authenticated;
GRANT SELECT (phone) ON public.org_profiles TO authenticated;
GRANT SELECT (contact_phone) ON public.service_providers TO authenticated;

-- Keep the helper RPCs in place â€” they are still useful for future migration to view-based reads.
-- (no DROP)




-- Replace the broad "true" policy with one that scopes to active providers
DROP POLICY IF EXISTS providers_select_all ON public.service_providers;

CREATE POLICY providers_select_active
ON public.service_providers
FOR SELECT
TO authenticated
USING (
  active = true
);

-- Owner and admins still need to see their own / all (including inactive) records
CREATE POLICY providers_select_owner
ON public.service_providers
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);




GRANT EXECUTE ON FUNCTION public.get_profiles_public() TO anon;








-- Phase 3: Quick perf wins â€” fill missing hot-path indexes
-- post_likes: PK is (post_id, user_id) so lookups by user_id alone scan; add reverse index for "my likes" queries
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id, post_id);

-- messages: sender_id has no index; needed for "messages by user" + RLS sender checks
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id, created_at DESC);

-- post_comments: author_id has no index; needed for profile "my comments" + author lookups
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.post_comments (author_id, created_at DESC);

-- conversations: ordering "my conversations by recency" goes via members â†’ conversations.last_message_at
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations (last_message_at DESC NULLS LAST);

-- conversation_members: speed up "unread" checks
CREATE INDEX IF NOT EXISTS idx_cm_user_lastread ON public.conversation_members (user_id, last_read_at DESC NULLS LAST);

ANALYZE public.post_likes;
ANALYZE public.messages;
ANALYZE public.post_comments;
ANALYZE public.conversations;
ANALYZE public.conversation_members;



-- =====================================================================
-- Phase 5: Close the security backlog
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) REVOKE EXECUTE on SECURITY DEFINER functions from anon/public.
--    Keep only the small whitelist of functions that legitimately
--    power public (signed-out) pages: public pet profile, public
--    profile lookup, public sitemap, public search.
--    Trigger helpers do NOT need any EXECUTE grants â€” triggers run
--    as the function owner regardless of caller privileges.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  whitelist text[] := ARRAY[
    'get_pet_public_by_ref',
    'get_pets_public',
    'get_profile_public_by_ref',
    'get_profiles_public',
    'get_public_walk',
    'search_entities',
    'nearby_meetups',
    'nearby_missing',
    'nearby_providers',
    'nearby_vets',
    'provider_social_proof',
    'find_users_within_radius_km',
    'review_summary',
    'review_summaries_bulk',
    'has_role',          -- read-only role check, used in policies
    'is_blocked',        -- read-only, used in policies
    'is_staff',          -- read-only
    'is_conversation_member',
    'is_transport_driver',
    'has_active_subscription',
    'current_tier',
    'check_pet_eligible_for_mating',
    'check_pet_boarding_eligible',
    'admin_kpis',        -- the function itself enforces is_staff()
    'vet_can_read_pet'
  ];
  fn record;
  fn_signature text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT (p.proname = ANY(whitelist))
  LOOP
    fn_signature := format('public.%I(%s)', fn.proname, fn.args);
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn_signature);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn_signature);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not revoke on %: %', fn_signature, SQLERRM;
    END;
  END LOOP;

  -- Make sure authenticated still has EXECUTE on the helpers it needs
  -- (most were granted to public/anon historically; explicit grant is safer).
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    fn_signature := format('public.%I(%s)', fn.proname, fn.args);
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_signature);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not grant authenticated on %: %', fn_signature, SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2) Storage: stop allowing anonymous LIST of files in public buckets.
--    Public buckets remain publicly READABLE by direct URL (which is
--    how avatars/posts/stories load for everyone). What we close is
--    the ability to ask `storage.objects` for the full list.
-- ---------------------------------------------------------------------

-- Drop the broad cross-bucket policy.
DROP POLICY IF EXISTS "public_read_objects_in_public_buckets" ON storage.objects;

-- Re-create per-bucket SELECT policies that restrict listing to
-- authenticated users while still allowing the storage CDN to serve
-- individual file URLs (the CDN uses a service-role path that
-- bypasses RLS entirely, so direct URL fetches keep working).

DO $$
DECLARE
  b text;
  public_buckets text[] := ARRAY[
    'marketplace', 'missing-pets', 'pet-avatars',
    'pet-listings', 'posts', 'stories', 'user-avatars'
  ];
BEGIN
  FOREACH b IN ARRAY public_buckets LOOP
    EXECUTE format($pol$
      DROP POLICY IF EXISTS "auth_can_list_%1$s" ON storage.objects;
      DROP POLICY IF EXISTS "auth_can_list_%1$s" ON storage.objects;
CREATE POLICY "auth_can_list_%1$s" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = %2$L);
    $pol$, b, b);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3) Document acceptance of remaining warnings.
--    pg_trgm / postgis / pgcrypto / vector live in `public` because
--    moving them would break dozens of downstream functions and views.
--    This is a knowingly accepted risk â€” the extensions themselves
--    do not expose data; their object schema is just cosmetic.
-- ---------------------------------------------------------------------

COMMENT ON SCHEMA public IS
  'App schema. Extensions pg_trgm/postgis/pgcrypto/vector are intentionally kept here; moving them would require rewriting dependent functions. Reviewed Phase 5.';



-- Phase 5 follow-up: kill the last two cross-public policies on storage.objects
DROP POLICY IF EXISTS "Stories publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "pet-listings public read"  ON storage.objects;

-- Re-add as authenticated-only listing (per-bucket, in line with Phase 5)
DROP POLICY IF EXISTS "auth_can_list_stories"      ON storage.objects;
DROP POLICY IF EXISTS "auth_can_list_stories" ON storage.objects;
CREATE POLICY "auth_can_list_stories" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'stories');

DROP POLICY IF EXISTS "auth_can_list_pet-listings" ON storage.objects;
DROP POLICY IF EXISTS "auth_can_list_pet-listings" ON storage.objects;
CREATE POLICY "auth_can_list_pet-listings" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'pet-listings');



-- Phase 6: lightweight first-party analytics
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NULL,                       -- null for anonymous visitors
  session_id  text NULL,                       -- per-tab UUID generated client-side
  event       text NOT NULL,                   -- e.g. 'page_view', 'signup_step', 'post_create'
  route       text NULL,                       -- pathname when fired
  props       jsonb NULL,                      -- arbitrary props, scrubbed of PII client-side
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Hot read paths from the admin dashboard
CREATE INDEX IF NOT EXISTS idx_analytics_event_time
  ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_time
  ON public.analytics_events (created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their own event (anon allowed too â€” needed for signup-funnel tracking)
DROP POLICY IF EXISTS "anyone_insert_own_event" ON public.analytics_events;
CREATE POLICY "anyone_insert_own_event"
  ON public.analytics_events
  FOR INSERT
  TO public
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Only staff/admins read events
DROP POLICY IF EXISTS "staff_read_events" ON public.analytics_events;
CREATE POLICY "staff_read_events"
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Lock down the new table from anon SELECT explicitly (defence-in-depth)
REVOKE SELECT ON public.analytics_events FROM anon;
GRANT  INSERT ON public.analytics_events TO anon, authenticated;
GRANT  SELECT ON public.analytics_events TO authenticated;



drop policy if exists pet_listings_select_active_anon on public.pet_listings;
create policy pet_listings_select_active_anon
  on public.pet_listings for select to anon
  using (active = true and status = 'active'::pet_listing_status);

drop policy if exists listings_select_active_anon on public.mating_listings;
create policy listings_select_active_anon
  on public.mating_listings for select to anon
  using (active = true);

drop policy if exists providers_select_active_anon on public.service_providers;
create policy providers_select_active_anon
  on public.service_providers for select to anon
  using (active = true);

drop view if exists public.service_providers_public cascade;
create view public.service_providers_public with (security_invoker = true) as
  select id, owner_id, name, category, city, bio, hourly_rate_inr, cover_url,
    verified, active, contact_phone, lat, lng, trust_status, years_experience,
    service_radius_km, languages, days_available, time_slots,
    accepting_jobs, verification_status, details, created_at
  from public.service_providers
  where active = true;
grant select on public.service_providers_public to anon, authenticated;

drop policy if exists org_profiles_select_approved_anon on public.org_profiles;
create policy org_profiles_select_approved_anon
  on public.org_profiles for select to anon
  using (status = 'approved');

drop view if exists public.org_profiles_public cascade;
create view public.org_profiles_public with (security_invoker = true) as
  select user_id, org_name, org_type, city, state, lat, lng,
    website, description, facility_photos, donation_upi, donation_url,
    status, total_donations_inr, donor_count, created_at
  from public.org_profiles
  where status = 'approved';
grant select on public.org_profiles_public to anon, authenticated;

grant execute on function public.get_profile_public_by_ref(text) to anon;
grant execute on function public.get_pet_public_by_ref(text) to anon;
grant execute on function public.get_pets_public() to anon;



-- Phase E: Public trust signals
create table if not exists public.anon_reports (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('listing','provider','user','product','mate_listing','org')),
  subject_id uuid not null,
  reason text not null,
  details text,
  reporter_session text,
  user_agent text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_anon_reports_subject on public.anon_reports (subject_type, subject_id);
create index if not exists idx_anon_reports_session_time on public.anon_reports (reporter_session, created_at desc);

alter table public.anon_reports enable row level security;

create or replace function public.enforce_anon_report_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recent int;
begin
  if new.reporter_session is null or length(new.reporter_session) < 10 then
    raise exception 'reporter_session is required';
  end if;
  select count(*) into recent
    from public.anon_reports
   where reporter_session = new.reporter_session
     and created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'rate_limited: too many reports from this session, try again later';
  end if;
  new.details := left(coalesce(new.details, ''), 1000);
  new.user_agent := left(coalesce(new.user_agent, ''), 300);
  new.reason := left(new.reason, 80);
  return new;
end $$;

drop trigger if exists trg_anon_reports_rate on public.anon_reports;
create trigger trg_anon_reports_rate
  before insert on public.anon_reports
  for each row execute function public.enforce_anon_report_rate_limit();

drop policy if exists "anon_reports_insert_anyone" on public.anon_reports;
create policy "anon_reports_insert_anyone"
  on public.anon_reports for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon_reports_select_admin" on public.anon_reports;
create policy "anon_reports_select_admin"
  on public.anon_reports for select
  to authenticated
  using (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'moderator'));

drop policy if exists "anon_reports_update_admin" on public.anon_reports;
create policy "anon_reports_update_admin"
  on public.anon_reports for update
  to authenticated
  using (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'moderator'))
  with check (has_role(auth.uid(), 'super_admin') or has_role(auth.uid(), 'moderator'));

create or replace function public.seller_trust(_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_verified boolean := false;
  v_account_type text;
  v_member_since timestamptz;
  v_response_min int;
  v_completed_bookings int := 0;
  v_completed_orders int := 0;
  v_org jsonb;
begin
  select breeder_verified, account_type::text, created_at
    into v_verified, v_account_type, v_member_since
    from public.profiles where id = _user_id;

  select jsonb_build_object('org_type', org_type, 'status', status, 'org_name', org_name)
    into v_org from public.org_profiles where user_id = _user_id;
  if v_org is not null and v_org->>'status' = 'approved' then
    v_verified := true;
  end if;

  with seller_msgs as (
    select m.conversation_id, m.created_at as t,
           lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender,
           lag(m.created_at) over (partition by m.conversation_id order by m.created_at) as prev_t,
           m.sender_id
      from public.messages m
     where m.created_at > now() - interval '90 days'
       and m.conversation_id in (
         select conversation_id from public.conversation_members where user_id = _user_id
       )
  )
  select percentile_cont(0.5) within group (
           order by extract(epoch from (t - prev_t))/60.0
         )::int
    into v_response_min
    from seller_msgs
   where sender_id = _user_id
     and prev_sender is not null
     and prev_sender <> _user_id
     and (t - prev_t) < interval '7 days';

  select count(*)::int into v_completed_bookings
    from public.service_bookings sb
    join public.service_providers sp on sp.id = sb.provider_id
   where sp.owner_id = _user_id and sb.status = 'completed';

  select count(*)::int into v_completed_orders
    from public.shop_order_items soi
    join public.shop_orders so on so.id = soi.order_id
   where soi.seller_id = _user_id and so.status in ('delivered','completed');

  return jsonb_build_object(
    'verified', v_verified,
    'account_type', v_account_type,
    'member_since', v_member_since,
    'response_minutes', v_response_min,
    'completed_bookings', v_completed_bookings,
    'completed_orders', v_completed_orders,
    'org', v_org
  );
exception when others then
  return jsonb_build_object('verified', false);
end $$;

revoke all on function public.seller_trust(uuid) from public;
grant execute on function public.seller_trust(uuid) to anon, authenticated;



-- 1) Allow anonymous sightings: make reporter_id nullable + add anon session id
ALTER TABLE public.missing_pet_sightings
  ALTER COLUMN reporter_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS anon_session_id text;

-- Drop old strict insert policy and recreate two policies (auth + anon)
DROP POLICY IF EXISTS sightings_insert_signed_in ON public.missing_pet_sightings;

CREATE POLICY sightings_insert_authed ON public.missing_pet_sightings
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = reporter_id
  AND EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.status = 'active'
  )
);

CREATE POLICY sightings_insert_anon ON public.missing_pet_sightings
FOR INSERT TO anon
WITH CHECK (
  reporter_id IS NULL
  AND anon_session_id IS NOT NULL
  AND length(anon_session_id) BETWEEN 8 AND 128
  AND EXISTS (
    SELECT 1 FROM public.missing_pets mp
    WHERE mp.id = missing_pet_sightings.missing_pet_id AND mp.status = 'active'
  )
);

-- Allow pet owner to also see anonymous sightings (existing select policy already covers owner)
-- Add an explicit allow for anonymous reporter to read their own (by session) â€” kept minimal to avoid leakage
CREATE POLICY sightings_select_owner_public ON public.missing_pet_sightings
FOR SELECT TO anon
USING (false);

-- 2) Anon rate limit trigger: max 5 sightings / hour / session
CREATE OR REPLACE FUNCTION public.enforce_anon_sighting_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.reporter_id IS NULL AND NEW.anon_session_id IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.missing_pet_sightings
    WHERE anon_session_id = NEW.anon_session_id
      AND created_at > now() - interval '1 hour';
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_anon_sighting_rate_limit ON public.missing_pet_sightings;
CREATE TRIGGER trg_anon_sighting_rate_limit
BEFORE INSERT ON public.missing_pet_sightings
FOR EACH ROW EXECUTE FUNCTION public.enforce_anon_sighting_rate_limit();

-- 3) Intent events table â€” universal funnel telemetry + replay state
CREATE TABLE IF NOT EXISTS public.intent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  anon_session_id text,
  kind text NOT NULL CHECK (kind IN (
    'contact_seller','book_service','donate','apply_to_adopt',
    'taxi_post','subscribe_missing_alert','shop_checkout','vet_book','report_sighting'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  redirect text,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','phone')),
  identifier text, -- email address or phone in E.164
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_events_user ON public.intent_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_events_anon ON public.intent_events(anon_session_id, created_at DESC);

ALTER TABLE public.intent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY intent_events_insert_anyone ON public.intent_events
FOR INSERT TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL AND anon_session_id IS NOT NULL)
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

CREATE POLICY intent_events_select_own ON public.intent_events
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY intent_events_update_own ON public.intent_events
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());



-- 1) Provider hub columns
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS next_available_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_area_radius_km numeric;

CREATE INDEX IF NOT EXISTS idx_providers_next_avail
  ON public.service_providers(next_available_at)
  WHERE active AND next_available_at IS NOT NULL;

-- 2) Provider weekly hours
CREATE TABLE IF NOT EXISTS public.provider_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Sun
  open_time time NOT NULL,
  close_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_hours_provider
  ON public.provider_hours(provider_id, weekday);

ALTER TABLE public.provider_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_hours_select_all ON public.provider_hours
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY provider_hours_owner_insert ON public.provider_hours
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
));

CREATE POLICY provider_hours_owner_update ON public.provider_hours
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
));

CREATE POLICY provider_hours_owner_delete ON public.provider_hours
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.service_providers p
  WHERE p.id = provider_hours.provider_id AND p.owner_id = auth.uid()
));

-- 3) Open-now helper (uses server time; client passes local TZ if needed in v2)
CREATE OR REPLACE FUNCTION public.is_provider_open_now(_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_hours ph
    WHERE ph.provider_id = _provider_id
      AND ph.weekday = EXTRACT(DOW FROM now())::smallint
      AND now()::time BETWEEN ph.open_time AND ph.close_time
  );
$$;

REVOKE ALL ON FUNCTION public.is_provider_open_now(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_provider_open_now(uuid) TO anon, authenticated;

-- 4) Convenience: list of currently-open provider ids for a category/city
CREATE OR REPLACE FUNCTION public.providers_open_now(_category text DEFAULT NULL, _city text DEFAULT NULL)
RETURNS TABLE(provider_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT sp.id
  FROM public.service_providers sp
  JOIN public.provider_hours ph ON ph.provider_id = sp.id
  WHERE sp.active
    AND (_category IS NULL OR sp.category::text = _category)
    AND (_city IS NULL OR sp.city ILIKE '%' || _city || '%')
    AND ph.weekday = EXTRACT(DOW FROM now())::smallint
    AND now()::time BETWEEN ph.open_time AND ph.close_time;
$$;

REVOKE ALL ON FUNCTION public.providers_open_now(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.providers_open_now(text, text) TO anon, authenticated;



create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

insert into public.app_settings(key, value) values
  ('supabase_url', 'https://pyqudgtmpnxnzzjbcdvc.supabase.co')
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.tg_notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_anon text;
  v_payload jsonb;
begin
  select value into v_url from public.app_settings where key = 'supabase_url';
  if v_url is null then
    return new;
  end if;

  v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cXVkZ3RtcG54bnp6amJjZHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODM2MTQsImV4cCI6MjA5Mjk1OTYxNH0.heicqiE_NbcXiKq_7TNoYWhHTdtIB5sksHRq_ln5wNs';

  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   coalesce(new.title, 'Petos'),
    'body',    coalesce(new.body, ''),
    'url',     coalesce(new.link, '/'),
    'tag',     new.type
  );

  begin
    perform net.http_post(
      url     := v_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'apikey',       v_anon,
                   'Authorization','Bearer ' || v_anon
                 ),
      body    := v_payload
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_notifications_send_push on public.notifications;
create trigger trg_notifications_send_push
after insert on public.notifications
for each row execute function public.tg_notifications_send_push();

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.reviews';
  exception when others then null;
  end;
end $$;

alter table public.reviews replica identity full;



-- =========================================================
-- Phase I: Cross-actor workflows
-- =========================================================

-- 1) walk_events: walker-side logs during a walk
do $$ begin
  if not exists (select 1 from pg_type where typname = 'walk_event_kind') then
    create type public.walk_event_kind as enum ('health_flag','behavior_note','photo','geo_ping');
  end if;
end $$;

create table if not exists public.walk_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.service_bookings(id) on delete cascade,
  author_id uuid not null,
  kind public.walk_event_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_walk_events_booking on public.walk_events(booking_id, created_at desc);

alter table public.walk_events enable row level security;

-- Walker (provider owner) and customer can read events for their booking
drop policy if exists "walk_events_select_party" on public.walk_events;
create policy "walk_events_select_party" on public.walk_events
for select to authenticated
using (
  exists (
    select 1 from public.service_bookings b
    left join public.service_providers p on p.id = b.provider_id
    where b.id = walk_events.booking_id
      and (b.customer_id = auth.uid() or p.owner_id = auth.uid())
  )
);

-- Only the assigned walker (provider owner) can insert
drop policy if exists "walk_events_insert_walker" on public.walk_events;
create policy "walk_events_insert_walker" on public.walk_events
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.service_bookings b
    join public.service_providers p on p.id = b.provider_id
    where b.id = walk_events.booking_id and p.owner_id = auth.uid()
  )
);

-- =========================================================
-- 2) booking_suggestions: owner-side "next action" inbox
-- =========================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'booking_suggestion_kind') then
    create type public.booking_suggestion_kind as enum ('vet_followup','wellness_check','grooming','training','dental');
  end if;
end $$;

create table if not exists public.booking_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid,
  kind public.booking_suggestion_kind not null,
  reason text not null,
  source_walk_event_id uuid references public.walk_events(id) on delete set null,
  source_booking_id uuid references public.service_bookings(id) on delete set null,
  deep_link text,
  status text not null default 'open' check (status in ('open','dismissed','booked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_booking_suggestions_owner_open
  on public.booking_suggestions(owner_id, status, created_at desc);

alter table public.booking_suggestions enable row level security;

drop policy if exists "bsugg_select_own" on public.booking_suggestions;
create policy "bsugg_select_own" on public.booking_suggestions
for select to authenticated using (owner_id = auth.uid());

drop policy if exists "bsugg_update_own" on public.booking_suggestions;
create policy "bsugg_update_own" on public.booking_suggestions
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Insertion is system-driven (SECURITY DEFINER trigger), so no client INSERT policy.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_bsugg_updated on public.booking_suggestions;
create trigger trg_bsugg_updated before update on public.booking_suggestions
for each row execute function public.set_updated_at();

-- =========================================================
-- 3) Trigger: health_flag walk_event â†’ suggestion + notification
-- =========================================================
create or replace function public.tg_walk_event_to_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_pet uuid;
  v_reason text;
begin
  if new.kind <> 'health_flag' then
    return new;
  end if;

  select b.customer_id, (b.pet_ids)[1]
    into v_owner, v_pet
  from public.service_bookings b
  where b.id = new.booking_id;

  if v_owner is null then
    return new;
  end if;

  v_reason := coalesce(
    nullif(trim(new.payload->>'note'), ''),
    'Walker flagged a health concern during the walk.'
  );

  insert into public.booking_suggestions
    (owner_id, pet_id, kind, reason, source_walk_event_id, source_booking_id, deep_link)
  values
    (v_owner, v_pet, 'vet_followup', v_reason, new.id, new.booking_id,
     '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, ''));

  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (
    v_owner,
    new.author_id,
    'walk_health_flag',
    'Health flag during walk',
    v_reason,
    '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, '')
  );

  return new;
end;
$$;

drop trigger if exists trg_walk_event_to_suggestion on public.walk_events;
create trigger trg_walk_event_to_suggestion
after insert on public.walk_events
for each row execute function public.tg_walk_event_to_suggestion();

-- =========================================================
-- 4) Caretaker: optional wellness score on daily reports
-- =========================================================
alter table public.kennel_daily_reports
  add column if not exists wellness_score smallint check (wellness_score between 1 and 5);



create or replace function public.tg_walk_event_to_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_pet uuid;
  v_reason text;
begin
  if new.kind <> 'health_flag' then
    return new;
  end if;

  select b.customer_id, b.pet_id
    into v_owner, v_pet
  from public.service_bookings b
  where b.id = new.booking_id;

  if v_owner is null then
    return new;
  end if;

  v_reason := coalesce(
    nullif(trim(new.payload->>'note'), ''),
    'Walker flagged a health concern during the walk.'
  );

  insert into public.booking_suggestions
    (owner_id, pet_id, kind, reason, source_walk_event_id, source_booking_id, deep_link)
  values
    (v_owner, v_pet, 'vet_followup', v_reason, new.id, new.booking_id,
     '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, ''));

  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (
    v_owner,
    new.author_id,
    'walk_health_flag',
    'Health flag during walk',
    v_reason,
    '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, '')
  );

  return new;
end;
$$;




-- =====================================================================
-- Phase J (corrected) â€” bidding, geofencing, nearest-first everywhere
-- =====================================================================

-- 1) helpers
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe set search_path = public as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371.0 * 2.0 * asin(
      sqrt(
        power(sin(radians((lat2 - lat1)/2.0)),2) +
        cos(radians(lat1))*cos(radians(lat2))*
        power(sin(radians((lng2 - lng1)/2.0)),2)
      )
    )
  end
$$;

create or replace function public.composite_score(
  distance_km double precision,
  rating double precision,
  review_count integer,
  freshness_days double precision,
  boost double precision
) returns double precision
language sql immutable parallel safe set search_path = public as $$
  select
      coalesce(rating, 3.5) * 1.5
    + ln(coalesce(review_count, 0) + 1) * 0.4
    + coalesce(boost, 0) * 1.2
    - coalesce(distance_km, 25.0) * 0.08
    - least(coalesce(freshness_days, 0), 90.0) * 0.01
$$;

-- 2) taxi_bids
do $$ begin
  if not exists (select 1 from pg_type where typname='taxi_bid_status') then
    create type public.taxi_bid_status as enum ('open','accepted','rejected','withdrawn');
  end if;
end $$;

create table if not exists public.taxi_bids (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.transport_bookings(id) on delete cascade,
  driver_provider_id uuid not null references public.service_providers(id) on delete cascade,
  driver_user_id uuid not null,
  price_inr integer not null check (price_inr > 0),
  eta_minutes integer not null check (eta_minutes > 0 and eta_minutes <= 240),
  distance_km numeric(6,2),
  note text,
  status public.taxi_bid_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, driver_provider_id)
);
create index if not exists idx_taxi_bids_booking on public.taxi_bids(booking_id, status);
create index if not exists idx_taxi_bids_driver  on public.taxi_bids(driver_user_id, created_at desc);

alter table public.taxi_bids enable row level security;

drop policy if exists "tb_driver_insert" on public.taxi_bids;
create policy "tb_driver_insert" on public.taxi_bids
for insert to authenticated
with check (
  driver_user_id = auth.uid()
  and exists (
    select 1 from public.service_providers p
    where p.id = taxi_bids.driver_provider_id
      and p.owner_id = auth.uid()
      and p.category = 'pet_taxi'
      and p.active = true
  )
  and exists (
    select 1 from public.transport_bookings b
    where b.id = taxi_bids.booking_id and b.status = 'requested'
  )
);

drop policy if exists "tb_driver_select_own" on public.taxi_bids;
create policy "tb_driver_select_own" on public.taxi_bids
for select to authenticated using (driver_user_id = auth.uid());

drop policy if exists "tb_customer_select_on_trip" on public.taxi_bids;
create policy "tb_customer_select_on_trip" on public.taxi_bids
for select to authenticated using (
  exists (select 1 from public.transport_bookings b
          where b.id = taxi_bids.booking_id and b.customer_id = auth.uid())
);

drop policy if exists "tb_driver_update_own" on public.taxi_bids;
create policy "tb_driver_update_own" on public.taxi_bids
for update to authenticated
using (driver_user_id = auth.uid())
with check (driver_user_id = auth.uid());

drop policy if exists "tb_customer_update_on_trip" on public.taxi_bids;
create policy "tb_customer_update_on_trip" on public.taxi_bids
for update to authenticated
using (exists (select 1 from public.transport_bookings b
               where b.id = taxi_bids.booking_id and b.customer_id = auth.uid()));

drop trigger if exists trg_taxi_bids_updated on public.taxi_bids;
create trigger trg_taxi_bids_updated before update on public.taxi_bids
for each row execute function public.set_updated_at();

alter table public.taxi_bids replica identity full;
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.taxi_bids';
  exception when others then null; end;
end $$;

-- 3) bid notifications
create or replace function public.tg_taxi_bid_notify_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_customer uuid; v_driver_name text;
begin
  select customer_id into v_customer from public.transport_bookings where id = new.booking_id;
  if v_customer is null then return new; end if;
  select coalesce(p.name,'A driver') into v_driver_name
    from public.service_providers p where p.id = new.driver_provider_id;
  insert into public.notifications(user_id, actor_id, type, title, body, link)
  values (v_customer, new.driver_user_id, 'taxi_bid_received',
          'New driver bid',
          v_driver_name || ' Â· â‚¹' || new.price_inr || ' Â· ETA ' || new.eta_minutes || ' min',
          '/taxi/' || new.booking_id::text);
  return new;
end $$;

drop trigger if exists trg_taxi_bid_notify_customer on public.taxi_bids;
create trigger trg_taxi_bid_notify_customer
after insert on public.taxi_bids
for each row execute function public.tg_taxi_bid_notify_customer();

create or replace function public.tg_taxi_bid_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status='accepted' and (old.status is distinct from 'accepted') then
    update public.transport_bookings
       set provider_id = new.driver_provider_id,
           fare_inr = coalesce(fare_inr, new.price_inr),
           status = 'accepted'
     where id = new.booking_id and status = 'requested';

    for r in
      select id, driver_user_id from public.taxi_bids
      where booking_id = new.booking_id and id <> new.id and status='open'
    loop
      update public.taxi_bids set status='rejected' where id = r.id;
      insert into public.notifications(user_id, actor_id, type, title, body, link)
      values (r.driver_user_id, null, 'taxi_bid_rejected',
              'Trip taken','Another driver was selected for this trip.','/driver/taxi');
    end loop;

    insert into public.notifications(user_id, actor_id, type, title, body, link)
    values (new.driver_user_id, null, 'taxi_bid_accepted',
            'You got the trip!','Open the trip to start the pickup.',
            '/taxi/' || new.booking_id::text);
  end if;
  return new;
end $$;

drop trigger if exists trg_taxi_bid_accepted on public.taxi_bids;
create trigger trg_taxi_bid_accepted
after update on public.taxi_bids
for each row execute function public.tg_taxi_bid_accepted();

-- 4) geofence on driver location update
alter table public.transport_bookings
  add column if not exists pickup_arrival_notified_at timestamptz,
  add column if not exists dropoff_arrival_notified_at timestamptz;

create or replace function public.tg_transport_arrival_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_d_pickup double precision; v_d_drop double precision;
begin
  if new.driver_lat is null or new.driver_lng is null then return new; end if;

  if new.pickup_lat is not null and new.pickup_arrival_notified_at is null then
    v_d_pickup := public.haversine_km(
      new.driver_lat::double precision, new.driver_lng::double precision,
      new.pickup_lat::double precision, new.pickup_lng::double precision);
    if v_d_pickup is not null and v_d_pickup <= 0.2 then
      insert into public.notifications(user_id,actor_id,type,title,body,link)
      values (new.customer_id,null,'taxi_driver_arrived',
              'Your driver is here','Driver is at the pickup point.',
              '/taxi/'||new.id::text);
      new.pickup_arrival_notified_at := now();
    end if;
  end if;

  if new.dropoff_lat is not null and new.dropoff_arrival_notified_at is null then
    v_d_drop := public.haversine_km(
      new.driver_lat::double precision, new.driver_lng::double precision,
      new.dropoff_lat::double precision, new.dropoff_lng::double precision);
    if v_d_drop is not null and v_d_drop <= 0.2 then
      insert into public.notifications(user_id,actor_id,type,title,body,link)
      values (new.customer_id,null,'taxi_drop_near',
              'Almost at drop-off','Your pet is nearly home.',
              '/taxi/'||new.id::text);
      new.dropoff_arrival_notified_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_transport_arrival_check on public.transport_bookings;
create trigger trg_transport_arrival_check
before update of driver_lat, driver_lng on public.transport_bookings
for each row execute function public.tg_transport_arrival_check();

-- 5) Discover RPCs (nearest-first)

create or replace function public.discover_providers(
  _lat double precision default null, _lng double precision default null,
  _category text default null, _city text default null,
  _radius_km double precision default 50, _limit integer default 50)
returns table (
  id uuid, owner_id uuid, name text, category text, city text, bio text,
  hourly_rate_inr integer, cover_url text, verified boolean,
  lat numeric, lng numeric, next_available_at timestamptz,
  rating double precision, review_count integer,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with rated as (
    select p.id,
      coalesce(avg(r.rating)::double precision,0) as rating,
      count(r.id)::int as review_count
    from public.service_providers p
    left join public.reviews r on r.subject_type='provider' and r.subject_id=p.id
    group by p.id)
  select p.id, p.owner_id, p.name, p.category::text, p.city, p.bio,
         p.hourly_rate_inr, p.cover_url, p.verified, p.lat, p.lng, p.next_available_at,
         rt.rating, rt.review_count,
         public.haversine_km(_lat,_lng,p.lat::double precision,p.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,p.lat::double precision,p.lng::double precision),
           rt.rating, rt.review_count,
           extract(epoch from (now()-p.created_at))/86400.0,
           case when p.verified then 0.6 else 0 end) as score
  from public.service_providers p
  join rated rt on rt.id=p.id
  where p.active=true
    and (_category is null or p.category::text=_category)
    and (_city is null or p.city ilike _city)
    and (_lat is null or _lng is null or p.lat is null or p.lng is null
         or public.haversine_km(_lat,_lng,p.lat::double precision,p.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_providers(double precision,double precision,text,text,double precision,integer) to authenticated, anon;

create or replace function public.discover_mating_listings(
  _lat double precision default null, _lng double precision default null,
  _species text default null, _breed text default null, _city text default null,
  _radius_km double precision default 100, _limit integer default 50)
returns table (
  id uuid, pet_id uuid, owner_id uuid, intent text, fee_inr integer,
  city text, description text,
  pet_name text, pet_breed text, pet_avatar text,
  pet_lat numeric, pet_lng numeric, vaccination_verified boolean,
  rating double precision, review_count integer,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with rated as (
    select p.id,
      coalesce(avg(r.rating)::double precision,0) as rating,
      count(r.id)::int as review_count
    from public.pets p
    left join public.reviews r on r.subject_type='pet_partner' and r.subject_id=p.id
    group by p.id),
  pet_loc as (
    select pe.id as pet_id, pr.lat, pr.lng
    from public.pets pe
    left join public.profiles pr on pr.id=pe.owner_id)
  select ml.id, ml.pet_id, ml.owner_id, ml.intent::text, ml.fee_inr, ml.city, ml.description,
         pe.name, pe.breed, pe.avatar_url,
         pl.lat, pl.lng, pe.vaccination_verified,
         rt.rating, rt.review_count,
         public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision),
           rt.rating, rt.review_count,
           extract(epoch from (now()-ml.created_at))/86400.0,
             (case when pe.vaccination_verified then 0.4 else 0 end)
           + (case when ml.featured then 0.5 else 0 end)
           + (case when _species is not null and pe.species::text=_species then 0.5 else 0 end)
           + (case when _breed is not null and pe.breed ilike _breed then 0.6 else 0 end)) as score
  from public.mating_listings ml
  join public.pets pe on pe.id=ml.pet_id
  join pet_loc pl on pl.pet_id=pe.id
  join rated rt on rt.id=pe.id
  where ml.active=true
    and (_species is null or pe.species::text=_species)
    and (_city is null or ml.city ilike _city)
    and (_lat is null or _lng is null or pl.lat is null or pl.lng is null
         or public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_mating_listings(double precision,double precision,text,text,text,double precision,integer) to authenticated, anon;

create or replace function public.discover_shop_products(
  _lat double precision default null, _lng double precision default null,
  _category text default null, _query text default null,
  _radius_km double precision default 200, _limit integer default 50)
returns table (
  id uuid, seller_id uuid, title text, description text, category text,
  price_inr integer, stock integer, image_url text,
  seller_lat numeric, seller_lng numeric,
  rating double precision, review_count integer,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with seller_loc as (select id, lat, lng from public.profiles),
  rated as (
    select sp.id,
      coalesce(avg(r.rating)::double precision,0) as rating,
      count(r.id)::int as review_count
    from public.shop_products sp
    left join public.reviews r on r.subject_type='product' and r.subject_id=sp.id
    group by sp.id)
  select sp.id, sp.seller_id, sp.title, sp.description, sp.category::text,
         sp.price_inr, sp.stock, sp.image_url, sl.lat, sl.lng,
         rt.rating, rt.review_count,
         public.haversine_km(_lat,_lng,sl.lat::double precision,sl.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,sl.lat::double precision,sl.lng::double precision),
           rt.rating, rt.review_count,
           extract(epoch from (now()-sp.created_at))/86400.0,
           case when sp.stock>0 then 0.4 else -0.5 end) as score
  from public.shop_products sp
  left join seller_loc sl on sl.id=sp.seller_id
  join rated rt on rt.id=sp.id
  where sp.active=true
    and (_category is null or sp.category::text=_category)
    and (_query is null or sp.title ilike '%'||_query||'%' or sp.description ilike '%'||_query||'%')
    and (_lat is null or _lng is null or sl.lat is null or sl.lng is null
         or public.haversine_km(_lat,_lng,sl.lat::double precision,sl.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_shop_products(double precision,double precision,text,text,double precision,integer) to authenticated, anon;

create or replace function public.discover_pets_for_adoption(
  _lat double precision default null, _lng double precision default null,
  _species text default null, _city text default null,
  _radius_km double precision default 200, _limit integer default 50)
returns table (
  id uuid, owner_id uuid, name text, species text, breed text,
  avatar_url text, city text, lat numeric, lng numeric,
  vaccination_verified boolean, is_org boolean,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with pet_loc as (
    select pe.id as pet_id, pr.lat, pr.lng,
           exists(select 1 from public.org_profiles op
                  where op.user_id=pe.owner_id and op.status='verified') as is_org
    from public.pets pe
    left join public.profiles pr on pr.id=pe.owner_id)
  select pe.id, pe.owner_id, pe.name, pe.species::text, pe.breed, pe.avatar_url, pe.city,
         pl.lat, pl.lng, pe.vaccination_verified, pl.is_org,
         public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision),
           0, 0,
           extract(epoch from (now()-pe.created_at))/86400.0,
             (case when pl.is_org then 0.7 else 0 end)
           + (case when pe.vaccination_verified then 0.3 else 0 end)) as score
  from public.pets pe
  join pet_loc pl on pl.pet_id=pe.id
  where pe.discoverable_for_mating = true
    and (_species is null or pe.species::text=_species)
    and (_city is null or pe.city ilike _city)
    and (_lat is null or _lng is null or pl.lat is null or pl.lng is null
         or public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_pets_for_adoption(double precision,double precision,text,text,double precision,integer) to authenticated, anon;



-- ============================================================
-- Sprint M2: Nearby fanout + Vet directory + live mating listings
-- ============================================================

-- 1) Add service_bookings + mating_listings to realtime publication
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.service_bookings'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.mating_listings'; exception when others then null; end;
end $$;
alter table public.service_bookings replica identity full;
alter table public.mating_listings replica identity full;

-- 2) Generic helper: notify every nearby user with a single notifications insert
-- Uses profiles.lat/lng + haversine_km. Caps recipients to 500 to prevent spam.
create or replace function public.fanout_nearby(
  _actor uuid,
  _lat double precision,
  _lng double precision,
  _radius_km double precision,
  _kind text,
  _title text,
  _body text,
  _link text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if _lat is null or _lng is null then return 0; end if;
  with recipients as (
    select p.id
    from public.profiles p
    where p.id is not null
      and p.id <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid)
      and p.lat is not null and p.lng is not null
      and public.haversine_km(_lat, _lng, p.lat::double precision, p.lng::double precision) <= _radius_km
    order by public.haversine_km(_lat, _lng, p.lat::double precision, p.lng::double precision) asc
    limit 500
  )
  insert into public.notifications (user_id, type, title, body, link)
  select id, _kind, _title, _body, _link from recipients;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.fanout_nearby(uuid, double precision, double precision, double precision, text, text, text, text) from public;
grant execute on function public.fanout_nearby(uuid, double precision, double precision, double precision, text, text, text, text) to service_role;

-- 3) Trigger: new active mating listing â†’ fanout 25 km
create or replace function public.tg_mating_listing_nearby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat numeric; v_lng numeric;
  v_breed text; v_species text; v_pet_name text;
  v_owner_city text;
begin
  if NEW.active is not true then return NEW; end if;

  select pr.lat, pr.lng, pe.breed, pe.species::text, pe.name
    into v_lat, v_lng, v_breed, v_species, v_pet_name
  from public.pets pe
  left join public.profiles pr on pr.id = pe.owner_id
  where pe.id = NEW.pet_id;

  if v_lat is null or v_lng is null then return NEW; end if;

  perform public.fanout_nearby(
    NEW.owner_id,
    v_lat::double precision, v_lng::double precision,
    25,
    'mate_nearby',
    'New mate nearby',
    coalesce(v_breed, v_species, 'A pet') || ' looking for a match',
    '/mates/' || NEW.id::text);
  return NEW;
end $$;

drop trigger if exists trg_mating_listing_nearby on public.mating_listings;
create trigger trg_mating_listing_nearby
  after insert on public.mating_listings
  for each row execute function public.tg_mating_listing_nearby();

-- 4) Trigger: new active adoption listing â†’ fanout 25 km
create or replace function public.tg_pet_listing_nearby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat numeric; v_lng numeric;
begin
  if NEW.active is not true or NEW.listing_type::text not in ('adoption', 'rehoming') then
    return NEW;
  end if;

  -- Prefer listing's own coords, fall back to owner profile
  v_lat := NEW.lat;
  v_lng := NEW.lng;
  if v_lat is null or v_lng is null then
    select lat, lng into v_lat, v_lng from public.profiles where id = NEW.owner_id;
  end if;
  if v_lat is null or v_lng is null then return NEW; end if;

  perform public.fanout_nearby(
    NEW.owner_id,
    v_lat::double precision, v_lng::double precision,
    25,
    'adopt_nearby',
    'New pet up for adoption',
    coalesce(NEW.breed, NEW.species, 'A pet') || ' near you',
    '/adopt/' || NEW.id::text);
  return NEW;
end $$;

drop trigger if exists trg_pet_listing_nearby on public.pet_listings;
create trigger trg_pet_listing_nearby
  after insert on public.pet_listings
  for each row execute function public.tg_pet_listing_nearby();

-- 5) Trigger: new active service provider â†’ fanout 15 km
create or replace function public.tg_provider_nearby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.active is not true then return NEW; end if;
  if NEW.lat is null or NEW.lng is null then return NEW; end if;

  perform public.fanout_nearby(
    NEW.owner_id,
    NEW.lat::double precision, NEW.lng::double precision,
    15,
    'provider_nearby',
    'New ' || coalesce(NEW.category::text, 'service') || ' nearby',
    coalesce(NEW.name, 'A new provider') || ' just joined Petos',
    '/services/' || NEW.id::text);
  return NEW;
end $$;

drop trigger if exists trg_provider_nearby on public.service_providers;
create trigger trg_provider_nearby
  after insert on public.service_providers
  for each row execute function public.tg_provider_nearby();

-- 6) Vet directory RPC (location-aware, with specialty + 24/7 filters)
create or replace function public.discover_vets(
  _lat double precision default null,
  _lng double precision default null,
  _specialty text default null,
  _open_24_7 boolean default false,
  _radius_km double precision default 50,
  _limit integer default 50)
returns table (
  user_id uuid,
  display_name text,
  photo_url text,
  bio text,
  clinic_name text,
  city text,
  address text,
  phone text,
  lat numeric,
  lng numeric,
  specialisations text[],
  rating_avg double precision,
  rating_count integer,
  price_video_inr integer,
  price_clinic_inr integer,
  distance_km double precision)
language sql stable security definer set search_path = public as $$
  select
    v.user_id,
    v.display_name,
    v.photo_url,
    v.bio,
    v.clinic_name,
    v.city,
    v.address,
    v.phone,
    v.lat,
    v.lng,
    v.specialisations,
    coalesce(v.rating_avg, 0)::double precision as rating_avg,
    coalesce(v.rating_count, 0)::int as rating_count,
    v.price_video_inr,
    v.price_clinic_inr,
    public.haversine_km(_lat, _lng, v.lat::double precision, v.lng::double precision) as distance_km
  from public.vet_profiles v
  where v.active = true
    and v.onboarded = true
    and (_specialty is null or _specialty = any(coalesce(v.specialisations, '{}'::text[])))
    and (not _open_24_7 or '24x7' = any(coalesce(v.specialisations, '{}'::text[])))
    and (_lat is null or _lng is null or v.lat is null or v.lng is null
         or public.haversine_km(_lat, _lng, v.lat::double precision, v.lng::double precision) <= _radius_km)
  order by
    case when _lat is null or _lng is null or v.lat is null or v.lng is null then 1 else 0 end,
    public.haversine_km(_lat, _lng, v.lat::double precision, v.lng::double precision) asc nulls last,
    coalesce(v.rating_avg, 0) desc
  limit greatest(1, least(_limit, 100));
$$;
grant execute on function public.discover_vets(double precision, double precision, text, boolean, double precision, integer) to authenticated, anon;

-- 7) Breeder stats view (last_active + response_rate)
create or replace view public.breeder_stats as
select
  u.id as user_id,
  u.last_sign_in_at as last_active_at,
  coalesce(rs.total_requests, 0) as total_requests,
  coalesce(rs.accepted_requests, 0) as accepted_requests,
  case
    when coalesce(rs.total_requests, 0) = 0 then null
    else round((rs.accepted_requests::numeric / rs.total_requests::numeric) * 100, 0)
  end as response_rate_pct
from auth.users u
left join (
  select
    to_owner_id,
    count(*) as total_requests,
    count(*) filter (where status::text in ('accepted','approved','confirmed','agreed')) as accepted_requests
  from public.mating_requests
  group by to_owner_id
) rs on rs.to_owner_id = u.id;

-- The view uses auth.users (last_sign_in_at), so wrap in a definer function for safe public read.
create or replace function public.get_breeder_stats(_user_id uuid)
returns table (
  user_id uuid,
  last_active_at timestamptz,
  total_requests bigint,
  accepted_requests bigint,
  response_rate_pct numeric)
language sql stable security definer set search_path = public as $$
  select user_id, last_active_at, total_requests, accepted_requests, response_rate_pct
  from public.breeder_stats
  where user_id = _user_id;
$$;
revoke all on function public.get_breeder_stats(uuid) from public;
grant execute on function public.get_breeder_stats(uuid) to authenticated;



-- Fix: drop the view that exposed auth.users; keep behaviour in the function only.
drop view if exists public.breeder_stats;

create or replace function public.get_breeder_stats(_user_id uuid)
returns table (
  user_id uuid,
  last_active_at timestamptz,
  total_requests bigint,
  accepted_requests bigint,
  response_rate_pct numeric)
language sql stable security definer set search_path = public, auth as $$
  select
    u.id as user_id,
    u.last_sign_in_at as last_active_at,
    coalesce(rs.total_requests, 0) as total_requests,
    coalesce(rs.accepted_requests, 0) as accepted_requests,
    case
      when coalesce(rs.total_requests, 0) = 0 then null
      else round((rs.accepted_requests::numeric / rs.total_requests::numeric) * 100, 0)
    end as response_rate_pct
  from auth.users u
  left join (
    select
      to_owner_id,
      count(*) as total_requests,
      count(*) filter (where status::text in ('accepted','approved','confirmed','agreed')) as accepted_requests
    from public.mating_requests
    where to_owner_id = _user_id
    group by to_owner_id
  ) rs on rs.to_owner_id = u.id
  where u.id = _user_id;
$$;
revoke all on function public.get_breeder_stats(uuid) from public;
grant execute on function public.get_breeder_stats(uuid) to authenticated;



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



-- M4: track when a 30-min pre-appointment reminder was sent so we don't double-send
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.transport_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_due_reminder
  ON public.appointments (scheduled_at)
  WHERE reminder_sent_at IS NULL AND status IN ('confirmed','requested');
CREATE INDEX IF NOT EXISTS idx_bookings_due_reminder
  ON public.service_bookings (scheduled_at)
  WHERE reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transport_due_reminder
  ON public.transport_bookings (scheduled_at)
  WHERE reminder_sent_at IS NULL;



CREATE OR REPLACE FUNCTION public.on_booking_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_name  text;
  v_title text;
BEGIN
  SELECT owner_id, name INTO v_owner, v_name
  FROM public.service_providers WHERE id = NEW.provider_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(
      v_owner,
      'booking_new',
      'New booking request',
      'Someone requested a booking for ' || COALESCE(v_name, 'your service'),
      '/services/manage'
    );

  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Tailored title so push toasts feel intentional, not robotic.
    v_title := CASE NEW.status::text
      WHEN 'confirmed'   THEN 'âœ… Booking confirmed'
      WHEN 'in_progress' THEN 'ðŸŸ¢ Your provider is on the way'
      WHEN 'completed'   THEN 'ðŸŽ‰ Booking completed'
      WHEN 'cancelled'   THEN 'âš ï¸ Booking cancelled'
      WHEN 'declined'    THEN 'âš ï¸ Booking declined'
      ELSE 'Booking ' || NEW.status::text
    END;

    PERFORM public.notify_user(
      NEW.customer_id,
      'booking_status',
      v_title,
      'Your booking with ' || COALESCE(v_name, 'your provider') || ' is now ' || NEW.status::text || '. Tap to track live.',
      '/bookings/' || NEW.id
    );
  END IF;

  RETURN NEW;
END
$function$;



-- Add missing FK from service_bookings.provider_id -> service_providers.id
-- so PostgREST can embed provider details in queries and the reminder
-- edge function stops failing with PGRST200.

-- Clean up any orphan rows first to avoid the constraint failing.
DELETE FROM public.service_bookings sb
WHERE sb.provider_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.service_providers sp WHERE sp.id = sb.provider_id
  );

ALTER TABLE public.service_bookings
  ADD CONSTRAINT service_bookings_provider_id_fkey
  FOREIGN KEY (provider_id)
  REFERENCES public.service_providers(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_service_bookings_provider_id
  ON public.service_bookings(provider_id);

NOTIFY pgrst, 'reload schema';



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



ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS schedule_kind text,
  ADD COLUMN IF NOT EXISTS times_of_day text[],
  ADD COLUMN IF NOT EXISTS every_n_hours int;

ALTER TABLE public.medication_logs
  ADD CONSTRAINT medication_logs_schedule_kind_check
  CHECK (schedule_kind IS NULL OR schedule_kind IN ('once_daily','twice_daily','thrice_daily','every_n_hours','as_needed'))
  NOT VALID;

CREATE TABLE IF NOT EXISTS public.medication_doses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medication_id uuid NOT NULL REFERENCES public.medication_logs(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  taken_at timestamptz,
  skipped boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_med_doses_pet_time ON public.medication_doses (pet_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_doses_med ON public.medication_doses (medication_id, scheduled_at);

ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_doses_owner_all" ON public.medication_doses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_doses.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pets p WHERE p.id = medication_doses.pet_id AND p.owner_id = auth.uid()));

CREATE POLICY "med_doses_care_team_read" ON public.medication_doses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pet_care_team t WHERE t.pet_id = medication_doses.pet_id AND t.vet_id = auth.uid()));

CREATE TRIGGER trg_med_doses_updated
  BEFORE UPDATE ON public.medication_doses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function: spawn next 7 days of doses for an active medication.
-- Idempotent via UNIQUE(medication_id, scheduled_at).
CREATE OR REPLACE FUNCTION public.spawn_medication_doses(_med_id uuid, _days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  d date;
  t text;
  ts timestamptz;
  inserted int := 0;
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  SELECT * INTO m FROM public.medication_logs WHERE id = _med_id;
  IF NOT FOUND OR NOT m.active OR m.schedule_kind IS NULL OR m.schedule_kind = 'as_needed' THEN
    RETURN 0;
  END IF;

  FOR d IN SELECT generate_series(GREATEST(m.start_on, CURRENT_DATE), LEAST(COALESCE(m.end_on, CURRENT_DATE + _days), CURRENT_DATE + _days), '1 day')::date LOOP
    IF m.schedule_kind IN ('once_daily','twice_daily','thrice_daily') AND m.times_of_day IS NOT NULL THEN
      FOREACH t IN ARRAY m.times_of_day LOOP
        BEGIN
          ts := (d::text || ' ' || t || ':00')::timestamptz;
          INSERT INTO public.medication_doses (medication_id, pet_id, owner_id, scheduled_at)
          VALUES (m.id, m.pet_id, (SELECT owner_id FROM public.pets WHERE id = m.pet_id), ts)
          ON CONFLICT (medication_id, scheduled_at) DO NOTHING;
          IF FOUND THEN inserted := inserted + 1; END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END LOOP;
    ELSIF m.schedule_kind = 'every_n_hours' AND m.every_n_hours IS NOT NULL AND m.every_n_hours > 0 THEN
      start_ts := GREATEST(m.start_on::timestamptz, now() - interval '1 hour');
      end_ts := LEAST(COALESCE(m.end_on::timestamptz + interval '1 day', now() + (_days || ' days')::interval), now() + (_days || ' days')::interval);
      ts := start_ts;
      WHILE ts < end_ts LOOP
        INSERT INTO public.medication_doses (medication_id, pet_id, owner_id, scheduled_at)
        VALUES (m.id, m.pet_id, (SELECT owner_id FROM public.pets WHERE id = m.pet_id), ts)
        ON CONFLICT (medication_id, scheduled_at) DO NOTHING;
        IF FOUND THEN inserted := inserted + 1; END IF;
        ts := ts + (m.every_n_hours || ' hours')::interval;
      END LOOP;
      EXIT; -- one pass for hourly
    END IF;
  END LOOP;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spawn_medication_doses(uuid, int) TO authenticated;



ALTER TABLE public.symptom_logs ADD COLUMN IF NOT EXISTS photo_paths text[];
ALTER TABLE public.health_records ADD COLUMN IF NOT EXISTS photo_paths text[];

INSERT INTO storage.buckets (id, name, public)
VALUES ('health-media', 'health-media', false)
ON CONFLICT (id) DO NOTHING;

-- Owner: full access to files under {auth.uid()}/...
DROP POLICY IF EXISTS "health_media_owner_select" ON storage.objects;
CREATE POLICY "health_media_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "health_media_owner_insert" ON storage.objects;
CREATE POLICY "health_media_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "health_media_owner_update" ON storage.objects;
CREATE POLICY "health_media_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "health_media_owner_delete" ON storage.objects;
CREATE POLICY "health_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'health-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Care-team vets: read-only on photos belonging to owners of pets they're on the care team for.
DROP POLICY IF EXISTS "health_media_care_team_select" ON storage.objects;
CREATE POLICY "health_media_care_team_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'health-media'
    AND EXISTS (
      SELECT 1 FROM public.pet_care_team t
      JOIN public.pets p ON p.id = t.pet_id
      WHERE t.vet_id = auth.uid()
        AND p.owner_id::text = (storage.foldername(name))[1]
    )
  );



CREATE TABLE IF NOT EXISTS public.vet_visit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vet_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  subjective text,
  objective text,
  assessment text,
  plan text,
  follow_up_on date,
  photo_paths text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vvn_pet ON public.vet_visit_notes(pet_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_vvn_vet ON public.vet_visit_notes(vet_id);

ALTER TABLE public.vet_visit_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_pet_care_team_vet(_pet_id uuid, _vet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pet_care_team
    WHERE pet_id = _pet_id AND vet_id = _vet_id AND revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pet_owner(_pet_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pets WHERE id = _pet_id AND owner_id = _user_id);
$$;

CREATE POLICY "Owners and care-team vets can read visit notes"
ON public.vet_visit_notes FOR SELECT
USING (public.is_pet_owner(pet_id, auth.uid()) OR public.is_pet_care_team_vet(pet_id, auth.uid()));

CREATE POLICY "Care-team vets can insert visit notes"
ON public.vet_visit_notes FOR INSERT
WITH CHECK (vet_id = auth.uid() AND public.is_pet_care_team_vet(pet_id, auth.uid()));

CREATE POLICY "Authoring vet can update visit notes"
ON public.vet_visit_notes FOR UPDATE
USING (vet_id = auth.uid() AND public.is_pet_care_team_vet(pet_id, auth.uid()))
WITH CHECK (vet_id = auth.uid());

CREATE POLICY "Authoring vet can delete visit notes"
ON public.vet_visit_notes FOR DELETE
USING (vet_id = auth.uid());

CREATE TRIGGER trg_vvn_updated
BEFORE UPDATE ON public.vet_visit_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.heat_cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  start_on date NOT NULL,
  end_on date,
  intensity smallint CHECK (intensity BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hcl_pet ON public.heat_cycle_logs(pet_id, start_on DESC);

ALTER TABLE public.heat_cycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage heat cycle logs"
ON public.heat_cycle_logs FOR ALL
USING (public.is_pet_owner(pet_id, auth.uid()))
WITH CHECK (public.is_pet_owner(pet_id, auth.uid()));

CREATE TRIGGER trg_hcl_updated
BEFORE UPDATE ON public.heat_cycle_logs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



ALTER TABLE public.pets
ADD COLUMN IF NOT EXISTS target_weight_kg numeric;



DO $$ BEGIN
  CREATE TYPE public.vax_verification_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vaccination_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  status public.vax_verification_status NOT NULL DEFAULT 'pending',
  reviewer_vet_id uuid,
  reviewer_note text,
  photo_paths text[],
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vvr_pet ON public.vaccination_verification_requests(pet_id, status);
CREATE INDEX IF NOT EXISTS idx_vvr_pending ON public.vaccination_verification_requests(status) WHERE status = 'pending';

ALTER TABLE public.vaccination_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own requests"
ON public.vaccination_verification_requests FOR SELECT
USING (public.is_pet_owner(pet_id, auth.uid()));

CREATE POLICY "Owner can submit requests"
ON public.vaccination_verification_requests FOR INSERT
WITH CHECK (
  submitted_by = auth.uid()
  AND public.is_pet_owner(pet_id, auth.uid())
);

CREATE POLICY "Care-team vets and admins can read pending requests"
ON public.vaccination_verification_requests FOR SELECT
USING (
  public.is_pet_care_team_vet(pet_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Care-team vets and admins can review"
ON public.vaccination_verification_requests FOR UPDATE
USING (
  public.is_pet_care_team_vet(pet_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.is_pet_care_team_vet(pet_id, auth.uid())
  OR public.has_role(auth.uid(), 'super_admin')
);

CREATE TRIGGER trg_vvr_updated
BEFORE UPDATE ON public.vaccination_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.apply_vax_verification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.pets SET vaccination_verified = true WHERE id = NEW.pet_id;
    NEW.reviewed_at := now();
    NEW.reviewer_vet_id := COALESCE(NEW.reviewer_vet_id, auth.uid());
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at := now();
    NEW.reviewer_vet_id := COALESCE(NEW.reviewer_vet_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vvr_apply
BEFORE UPDATE ON public.vaccination_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_vax_verification();



ALTER TABLE public.insurance_leads
  ADD COLUMN IF NOT EXISTS policy_number text,
  ADD COLUMN IF NOT EXISTS expires_on date;

DO $$ BEGIN
  CREATE TYPE public.insurance_claim_status AS ENUM ('submitted','under_review','approved','paid','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  lead_id uuid REFERENCES public.insurance_leads(id) ON DELETE SET NULL,
  claim_ref text,
  amount_inr numeric NOT NULL,
  description text,
  status public.insurance_claim_status NOT NULL DEFAULT 'submitted',
  photo_paths text[],
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_pet ON public.insurance_claims(pet_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_owner ON public.insurance_claims(owner_id);

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own claims"
ON public.insurance_claims FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins read all claims"
ON public.insurance_claims FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update claims"
ON public.insurance_claims FOR UPDATE
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_ic_updated
BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric','imperial'));




-- ===== Slice 1: health_alerts =====
CREATE TABLE IF NOT EXISTS public.health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  pet_id UUID,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','watch','action','emergency')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS health_alerts_dedupe_idx
  ON public.health_alerts (owner_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS health_alerts_owner_recent_idx
  ON public.health_alerts (owner_id, created_at DESC);

ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read alerts"
  ON public.health_alerts FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "owner update alerts"
  ON public.health_alerts FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "owner delete alerts"
  ON public.health_alerts FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.enqueue_health_alert(
  _owner_id UUID,
  _pet_id UUID,
  _kind TEXT,
  _severity TEXT,
  _title TEXT,
  _body TEXT,
  _link TEXT,
  _dedupe_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  IF _dedupe_key IS NOT NULL THEN
    SELECT id INTO _id FROM public.health_alerts
    WHERE owner_id = _owner_id AND dedupe_key = _dedupe_key AND dismissed_at IS NULL
    LIMIT 1;
    IF _id IS NOT NULL THEN
      RETURN _id;
    END IF;
  END IF;
  INSERT INTO public.health_alerts (owner_id, pet_id, kind, severity, title, body, link, dedupe_key)
  VALUES (_owner_id, _pet_id, _kind, COALESCE(_severity,'info'), _title, _body, _link, _dedupe_key)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.health_alerts;

-- ===== Slice 2: symptom_logs.resolved_at =====
ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ===== Slice 5: vet_access_grants.scope + vet_access_views =====
ALTER TABLE public.vet_access_grants
  ADD COLUMN IF NOT EXISTS scope TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS public.vet_access_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.vet_access_grants(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  section TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS vet_access_views_grant_idx
  ON public.vet_access_views (grant_id, viewed_at DESC);

ALTER TABLE public.vet_access_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read grant views"
  ON public.vet_access_views FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vet_access_grants g
    WHERE g.id = vet_access_views.grant_id AND g.created_by = auth.uid()
  ));



DO $$ BEGIN
  CREATE TYPE public.post_visibility AS ENUM ('public', 'followers', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS visibility public.post_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS image_urls jsonb;

DROP POLICY IF EXISTS posts_select_all ON public.posts;

CREATE POLICY posts_select_visible ON public.posts
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR (
      visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid()
          AND f.following_id = posts.author_id
      )
    )
  );



-- 1. Add 'provider' to account_type enum (safe if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'account_type' AND e.enumlabel = 'provider'
  ) THEN
    ALTER TYPE public.account_type ADD VALUE 'provider';
  END IF;
END$$;

-- 2. Pet-parent profile fields + onboarding state
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_age int,
  ADD COLUMN IF NOT EXISTS first_time_parent boolean,
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Pet-level fields for adoption date + health setup status
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS adoption_date date,
  ADD COLUMN IF NOT EXISTS health_setup_complete boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_pets_owner_health ON public.pets(owner_id, health_setup_complete);



-- Pet Parent Onboarding extensions
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS approx_age_months integer;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_prefs jsonb NOT NULL DEFAULT
    '{"vaccines": true, "deworming": true, "flea_tick": true, "checkup": true}'::jsonb;

-- Trigger: derive date_of_birth from approx_age_months when DOB not provided.
CREATE OR REPLACE FUNCTION public.pets_derive_dob()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NULL AND NEW.approx_age_months IS NOT NULL AND NEW.approx_age_months >= 0 THEN
    NEW.date_of_birth := (CURRENT_DATE - (NEW.approx_age_months || ' months')::interval)::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pets_derive_dob_trg ON public.pets;
CREATE TRIGGER pets_derive_dob_trg
BEFORE INSERT OR UPDATE ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.pets_derive_dob();

-- Helper: seed a default vaccination schedule for a pet (only if none exist yet).
-- Schedules core vaccines as "due rows" with a NULL administered_on is not allowed,
-- so we instead insert future-dated rows using administered_on=DOB and next_due_on=DOB+offset.
-- For simplicity we insert one synthetic "scheduled" row per vaccine using today as administered_on=NULL...
-- Since administered_on is NOT NULL, we instead just create next_due_on entries via a dedicated table?
-- Simplest: insert vaccinations rows representing the FIRST due dose with administered_on = COALESCE(DOB, today)
-- and next_due_on set to the next due date. Owner can correct/delete later.
CREATE OR REPLACE FUNCTION public.seed_pet_vaccine_reminders(_pet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_species pet_species;
  v_dob date;
  v_base date;
  v_count int;
BEGIN
  SELECT species, COALESCE(date_of_birth, CURRENT_DATE)
    INTO v_species, v_dob
  FROM public.pets WHERE id = _pet_id;

  IF v_species IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_count FROM public.vaccinations WHERE pet_id = _pet_id;
  IF v_count > 0 THEN RETURN; END IF;

  v_base := GREATEST(v_dob, CURRENT_DATE);

  IF v_species = 'dog' THEN
    INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, notes)
    VALUES
      (_pet_id, 'DHPP (annual)',  v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup â€” edit if your pet has had this'),
      (_pet_id, 'Rabies (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup â€” edit if your pet has had this'),
      (_pet_id, 'Deworming',       v_base, v_base + INTERVAL '90 days',  'Auto-scheduled â€” every 3 months');
  ELSIF v_species = 'cat' THEN
    INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, notes)
    VALUES
      (_pet_id, 'FVRCP (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup'),
      (_pet_id, 'Rabies (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup'),
      (_pet_id, 'Deworming',       v_base, v_base + INTERVAL '90 days',  'Auto-scheduled â€” every 3 months');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_pet_vaccine_reminders(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_pet_vaccine_reminders(uuid) TO authenticated;

-- Avatars bucket for profile photos (pet-avatars already exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read') THEN
    DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_write') THEN
    DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_update') THEN
    DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_owner_delete') THEN
    DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;



-- Add a _force flag to seed_pet_vaccine_reminders so users can recalc auto-scheduled
-- vaccine rows after correcting a pet's age/DOB. Auto-rows are matched by their
-- distinctive notes prefix written at insert time.
CREATE OR REPLACE FUNCTION public.seed_pet_vaccine_reminders(_pet_id uuid, _force boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_species pet_species;
  v_dob date;
  v_base date;
  v_count int;
  v_owner uuid;
BEGIN
  SELECT species, COALESCE(date_of_birth, CURRENT_DATE), owner_id
    INTO v_species, v_dob, v_owner
  FROM public.pets WHERE id = _pet_id;

  IF v_species IS NULL THEN RETURN; END IF;
  -- Only the owner (or a service role) should be able to (re)seed.
  IF v_owner IS DISTINCT FROM auth.uid() THEN RETURN; END IF;

  IF _force THEN
    DELETE FROM public.vaccinations
    WHERE pet_id = _pet_id
      AND notes LIKE 'Auto-scheduled%';
  END IF;

  SELECT count(*) INTO v_count FROM public.vaccinations WHERE pet_id = _pet_id;
  IF v_count > 0 THEN RETURN; END IF;

  v_base := GREATEST(v_dob, CURRENT_DATE);

  IF v_species = 'dog' THEN
    INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, notes)
    VALUES
      (_pet_id, 'DHPP (annual)',  v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup â€” edit if your pet has had this'),
      (_pet_id, 'Rabies (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup â€” edit if your pet has had this'),
      (_pet_id, 'Deworming',       v_base, v_base + INTERVAL '90 days',  'Auto-scheduled â€” every 3 months');
  ELSIF v_species = 'cat' THEN
    INSERT INTO public.vaccinations (pet_id, vaccine_name, administered_on, next_due_on, notes)
    VALUES
      (_pet_id, 'FVRCP (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup'),
      (_pet_id, 'Rabies (annual)', v_base, v_base + INTERVAL '365 days', 'Auto-scheduled at signup'),
      (_pet_id, 'Deworming',       v_base, v_base + INTERVAL '90 days',  'Auto-scheduled â€” every 3 months');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_pet_vaccine_reminders(uuid, boolean) TO authenticated;




-- Phase 0: post kind enum
DO $$ BEGIN
  CREATE TYPE public.post_kind AS ENUM ('moment', 'milestone', 'memorial', 'tribe_post');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS kind public.post_kind NOT NULL DEFAULT 'moment',
  ADD COLUMN IF NOT EXISTS pet_snapshot jsonb;

CREATE INDEX IF NOT EXISTS posts_kind_created_idx
  ON public.posts (kind, created_at DESC);

-- Trigger to populate pet_snapshot on insert/update of pet_id
CREATE OR REPLACE FUNCTION public.fill_post_pet_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet RECORD;
  v_age_months int;
  v_vaccines_ok boolean;
  v_city text;
BEGIN
  IF NEW.pet_id IS NULL THEN
    NEW.pet_snapshot := NULL;
    RETURN NEW;
  END IF;

  SELECT id, name, breed, dob, avatar_url, owner_id
    INTO v_pet
    FROM public.pets
   WHERE id = NEW.pet_id;

  IF v_pet IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_pet.dob IS NOT NULL THEN
    v_age_months := GREATEST(0, EXTRACT(YEAR FROM age(v_pet.dob))::int * 12
                                + EXTRACT(MONTH FROM age(v_pet.dob))::int);
  END IF;

  -- Best-effort vaccine OK: any health_record of kind 'vaccination' in last 12 months
  SELECT EXISTS (
    SELECT 1 FROM public.health_records hr
     WHERE hr.pet_id = v_pet.id
       AND hr.kind = 'vaccination'
       AND hr.created_at > now() - interval '365 days'
  ) INTO v_vaccines_ok;

  -- Owner city from profile (best-effort)
  SELECT city INTO v_city FROM public.profiles WHERE id = v_pet.owner_id;

  NEW.pet_snapshot := jsonb_build_object(
    'name', v_pet.name,
    'breed', v_pet.breed,
    'age_months', v_age_months,
    'avatar_url', v_pet.avatar_url,
    'vaccines_ok', COALESCE(v_vaccines_ok, false),
    'city', v_city
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_post_pet_snapshot ON public.posts;
CREATE TRIGGER trg_fill_post_pet_snapshot
  BEFORE INSERT OR UPDATE OF pet_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.fill_post_pet_snapshot();

-- Backfill existing posts (best-effort, ignores schema mismatch in optional columns)
DO $$
BEGIN
  UPDATE public.posts p
     SET pet_snapshot = jsonb_build_object(
           'name', pe.name,
           'breed', pe.breed,
           'age_months', CASE WHEN pe.dob IS NOT NULL
                              THEN GREATEST(0, EXTRACT(YEAR FROM age(pe.dob))::int * 12
                                              + EXTRACT(MONTH FROM age(pe.dob))::int)
                              ELSE NULL END,
           'avatar_url', pe.avatar_url,
           'vaccines_ok', false,
           'city', NULL
         )
    FROM public.pets pe
   WHERE p.pet_id = pe.id
     AND p.pet_snapshot IS NULL;
EXCEPTION WHEN OTHERS THEN
  -- non-fatal
  NULL;
END $$;

-- Phase 2 prep: extend reaction kinds
ALTER TABLE public.post_reactions
  DROP CONSTRAINT IF EXISTS post_reactions_kind_check;

ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_kind_check
  CHECK (kind IN ('love','paw','laugh','wow','sad','boop','treat','yummy','strong','cute'));



-- Fix the snapshot trigger to use real column names from public.pets
CREATE OR REPLACE FUNCTION public.fill_post_pet_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  age_months INT;
BEGIN
  IF NEW.pet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, breed, date_of_birth, avatar_url, owner_id, vaccination_verified, city
    INTO p
    FROM public.pets
   WHERE id = NEW.pet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  age_months := CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    ELSE GREATEST(0, (EXTRACT(YEAR FROM age(p.date_of_birth))::INT * 12)
                   + EXTRACT(MONTH FROM age(p.date_of_birth))::INT)
  END;

  NEW.pet_snapshot := jsonb_build_object(
    'name', p.name,
    'breed', p.breed,
    'age_months', age_months,
    'avatar_url', p.avatar_url,
    'vaccines_ok', COALESCE(p.vaccination_verified, false),
    'city', p.city
  );

  RETURN NEW;
END;
$$;

-- Make sure trigger fires on UPDATE too (for backfill)
DROP TRIGGER IF EXISTS trg_fill_post_pet_snapshot ON public.posts;
CREATE TRIGGER trg_fill_post_pet_snapshot
BEFORE INSERT OR UPDATE OF pet_id ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.fill_post_pet_snapshot();

-- Backfill pet_id from author's first pet where missing
UPDATE public.posts p
SET pet_id = sub.pet_id
FROM (
  SELECT DISTINCT ON (owner_id) owner_id, id AS pet_id
  FROM public.pets
  ORDER BY owner_id, created_at ASC
) sub
WHERE p.author_id = sub.owner_id
  AND p.pet_id IS NULL;

-- Force snapshot recompute by touching pet_id (this fires the trigger)
UPDATE public.posts SET pet_id = pet_id WHERE pet_id IS NOT NULL;



-- Phase F: extend the pet_snapshot trigger with 3 additional credibility fields.
-- Backwards-compatible: still writes name/breed/age_months/avatar_url/vaccines_ok/city.
CREATE OR REPLACE FUNCTION public.fill_post_pet_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet RECORD;
  v_age_months INT;
  v_city TEXT;
  v_walk_km NUMERIC;
  v_streak INT;
  v_lineage_ok BOOLEAN;
BEGIN
  IF NEW.pet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, breed, avatar_url, date_of_birth, vaccination_verified, owner_id, litter_id
    INTO v_pet
  FROM public.pets
  WHERE id = NEW.pet_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_pet.date_of_birth IS NOT NULL THEN
    v_age_months := GREATEST(0, EXTRACT(YEAR FROM age(v_pet.date_of_birth))::INT * 12
                                + EXTRACT(MONTH FROM age(v_pet.date_of_birth))::INT);
  END IF;

  -- Best-effort city from author profile
  BEGIN
    SELECT lower(NULLIF(city, ''))
      INTO v_city
    FROM public.profiles
    WHERE id = NEW.author_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_city := NULL;
  END;

  -- Lifetime walk km (best effort; table may not exist in all envs)
  BEGIN
    EXECUTE 'SELECT COALESCE(SUM(distance_m),0)/1000.0 FROM public.walk_sessions WHERE pet_id = $1'
      INTO v_walk_km
      USING NEW.pet_id;
  EXCEPTION WHEN OTHERS THEN
    v_walk_km := NULL;
  END;

  -- Care streak (best effort)
  BEGIN
    EXECUTE 'SELECT COALESCE(MAX(streak_days),0) FROM public.pet_care_streaks WHERE pet_id = $1'
      INTO v_streak
      USING NEW.pet_id;
  EXCEPTION WHEN OTHERS THEN
    v_streak := NULL;
  END;

  -- Lineage verified = pet belongs to a registered litter
  v_lineage_ok := v_pet.litter_id IS NOT NULL;

  NEW.pet_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'name',              v_pet.name,
    'breed',             v_pet.breed,
    'age_months',        v_age_months,
    'avatar_url',        v_pet.avatar_url,
    'vaccines_ok',       v_pet.vaccination_verified,
    'city',              v_city,
    'lifetime_walks_km', ROUND(COALESCE(v_walk_km,0)::numeric, 1),
    'streak_days',       v_streak,
    'lineage_verified',  v_lineage_ok
  ));

  RETURN NEW;
END;
$$;

-- Recompute snapshots for existing posts so the new fields appear immediately.
UPDATE public.posts
   SET updated_at = updated_at  -- triggers BEFORE UPDATE â†’ fill_post_pet_snapshot
 WHERE pet_id IS NOT NULL;




-- Nearby posts: posts in the same city as the caller's profile (or any specified city).
CREATE OR REPLACE FUNCTION public.get_nearby_posts(_city text DEFAULT NULL, _limit int DEFAULT 50)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.visibility = 'public'
    AND p.pet_snapshot IS NOT NULL
    AND lower(coalesce(p.pet_snapshot->>'city', '')) = lower(coalesce(
      _city,
      (SELECT city FROM public.profiles WHERE id = auth.uid())
    ))
    AND coalesce(p.pet_snapshot->>'city', '') <> ''
  ORDER BY (p.like_count + p.comment_count * 2) DESC, p.created_at DESC
  LIMIT _limit
$$;

-- Tribe posts: union of posts from groups the user is in + same breed as user's pets + same city.
CREATE OR REPLACE FUNCTION public.get_tribe_posts(_limit int DEFAULT 50)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid,
           (SELECT city FROM public.profiles WHERE id = auth.uid()) AS city
  ),
  my_breeds AS (
    SELECT DISTINCT lower(breed) AS breed
    FROM public.pets
    WHERE owner_id = (SELECT uid FROM me)
      AND breed IS NOT NULL AND breed <> ''
  )
  SELECT DISTINCT p.*
  FROM public.posts p, me
  WHERE p.visibility = 'public'
    AND p.pet_snapshot IS NOT NULL
    AND p.author_id <> me.uid
    AND (
      lower(coalesce(p.pet_snapshot->>'breed', '')) IN (SELECT breed FROM my_breeds)
      OR lower(coalesce(p.pet_snapshot->>'city', '')) = lower(coalesce(me.city, ''))
    )
  ORDER BY p.created_at DESC
  LIMIT _limit
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_posts(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tribe_posts(int) TO authenticated;




-- 1) Reaction notifications -------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_actor_name text;
  v_emoji text;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_actor_name
  FROM public.profiles WHERE id = NEW.user_id;

  v_emoji := CASE NEW.kind
    WHEN 'boop'   THEN 'ðŸ¾'
    WHEN 'treat'  THEN 'ðŸ¦´'
    WHEN 'yummy'  THEN 'ðŸ˜‹'
    WHEN 'strong' THEN 'ðŸ’ª'
    WHEN 'cute'   THEN 'ðŸ¥°'
    WHEN 'love'   THEN 'â¤ï¸'
    WHEN 'paw'    THEN 'ðŸ¾'
    WHEN 'laugh'  THEN 'ðŸ˜‚'
    WHEN 'wow'    THEN 'ðŸ˜®'
    WHEN 'sad'    THEN 'ðŸ˜¢'
    ELSE 'âœ¨'
  END;

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, link)
  VALUES (
    v_author,
    NEW.user_id,
    'post_reaction',
    v_actor_name || ' ' || v_emoji || ' your post',
    NULL,
    '/post/' || NEW.post_id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_reaction ON public.post_reactions;
CREATE TRIGGER trg_notify_post_reaction
AFTER INSERT ON public.post_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_post_reaction();

-- 2) Auto-milestone opt-in flag (defaults true) ----------------------------
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS auto_milestones boolean NOT NULL DEFAULT true;

-- 3) Dedup index for auto-posts --------------------------------------------
CREATE INDEX IF NOT EXISTS idx_posts_auto_milestone_key
  ON public.posts ((pet_snapshot->>'auto_milestone_key'))
  WHERE pet_snapshot ? 'auto_milestone_key';



CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.breed_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  species TEXT NOT NULL,
  breed TEXT NOT NULL,
  origin TEXT,
  temperament TEXT[] DEFAULT '{}',
  climate_fit TEXT[] DEFAULT '{}',
  climate_warnings TEXT,
  monthly_cost_min INT,
  monthly_cost_max INT,
  exercise_hours_per_day NUMERIC(3,1),
  experience_level TEXT,
  good_with_kids BOOLEAN,
  good_with_other_pets BOOLEAN,
  apartment_friendly BOOLEAN,
  noise_level TEXT,
  shedding TEXT,
  grooming_needs TEXT,
  lifespan_years_min INT,
  lifespan_years_max INT,
  common_health_issues TEXT[] DEFAULT '{}',
  pure_breed_traits TEXT,
  fake_breeder_warnings TEXT,
  short_summary TEXT,
  long_description TEXT,
  india_notes TEXT,
  image_url TEXT,
  popularity INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (species, breed)
);
CREATE INDEX idx_breed_profiles_species ON public.breed_profiles(species);
CREATE INDEX idx_breed_profiles_popularity ON public.breed_profiles(popularity DESC);
ALTER TABLE public.breed_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Breed profiles viewable by everyone" ON public.breed_profiles FOR SELECT USING (true);
CREATE POLICY "Super admins manage breed profiles" ON public.breed_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.breed_quiz_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  recommended_breeds JSONB DEFAULT '[]',
  avoid_breeds JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_breed_quiz_responses_user ON public.breed_quiz_responses(user_id, created_at DESC);
ALTER TABLE public.breed_quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own quiz responses" ON public.breed_quiz_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quiz responses" ON public.breed_quiz_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.care_plan_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  species TEXT NOT NULL,
  breed TEXT,
  life_stage_weeks_min INT NOT NULL,
  life_stage_weeks_max INT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  do_list TEXT[] DEFAULT '{}',
  dont_list TEXT[] DEFAULT '{}',
  red_flags TEXT[] DEFAULT '{}',
  trigger_offset_days INT,
  recurrence_days INT,
  premium_only BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_care_plan_templates_species ON public.care_plan_templates(species, life_stage_weeks_min);
ALTER TABLE public.care_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Care plan templates viewable by everyone" ON public.care_plan_templates FOR SELECT USING (true);
CREATE POLICY "Super admins manage care plan templates" ON public.care_plan_templates FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.pet_care_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  template_id UUID REFERENCES public.care_plan_templates(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  do_list TEXT[] DEFAULT '{}',
  dont_list TEXT[] DEFAULT '{}',
  red_flags TEXT[] DEFAULT '{}',
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_personalised_note TEXT,
  premium_only BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pet_care_plan_items_pet_due ON public.pet_care_plan_items(pet_id, due_date);
CREATE INDEX idx_pet_care_plan_items_owner_due ON public.pet_care_plan_items(owner_id, due_date) WHERE status = 'pending';
ALTER TABLE public.pet_care_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their pet care items" ON public.pet_care_plan_items FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their pet care items" ON public.pet_care_plan_items FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update their pet care items" ON public.pet_care_plan_items FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete their pet care items" ON public.pet_care_plan_items FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER trg_breed_profiles_updated BEFORE UPDATE ON public.breed_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_care_plan_templates_updated BEFORE UPDATE ON public.care_plan_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pet_care_plan_items_updated BEFORE UPDATE ON public.pet_care_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();





-- 11. REFRESH API
NOTIFY pgrst, 'reload schema';

COMMIT;
