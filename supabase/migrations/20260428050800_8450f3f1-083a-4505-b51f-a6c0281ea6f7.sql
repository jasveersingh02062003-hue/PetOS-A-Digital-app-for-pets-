-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user','pet_pal','boarding_provider','vet','ngo','moderator','finance','super_admin');
CREATE TYPE public.pet_species AS ENUM ('dog','cat','bird','rabbit','other');
CREATE TYPE public.pet_gender AS ENUM ('male','female');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  city TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

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

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
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
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at trigger helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PETS ============
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species public.pet_species NOT NULL,
  breed TEXT,
  date_of_birth DATE,
  gender public.pet_gender,
  weight_kg NUMERIC(5,2),
  neutered BOOLEAN DEFAULT false,
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  discoverable_for_mating BOOLEAN NOT NULL DEFAULT false,
  vaccination_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pets_select_all" ON public.pets FOR SELECT USING (true);
CREATE POLICY "pets_insert_own" ON public.pets FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pets_update_own" ON public.pets FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "pets_delete_own" ON public.pets FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER pets_set_updated_at BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX pets_owner_idx ON public.pets(owner_id);
CREATE INDEX pets_city_idx ON public.pets(city);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('pet-avatars','pet-avatars', true),
  ('user-avatars','user-avatars', true),
  ('posts','posts', true),
  ('vault-docs','vault-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Public read for public buckets
CREATE POLICY "public_read_pet_avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'pet-avatars');
CREATE POLICY "public_read_user_avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');
CREATE POLICY "public_read_posts" ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

-- Authenticated users upload to their own folder (folder name = uid)
CREATE POLICY "auth_upload_pet_avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pet-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_upload_user_avatars" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_upload_posts" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "auth_update_own_pet_avatars" ON storage.objects FOR UPDATE
  USING (bucket_id = 'pet-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_delete_own_pet_avatars" ON storage.objects FOR DELETE
  USING (bucket_id = 'pet-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_update_own_user_avatars" ON storage.objects FOR UPDATE
  USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_delete_own_user_avatars" ON storage.objects FOR DELETE
  USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth_delete_own_posts" ON storage.objects FOR DELETE
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Vault docs: only owner can read/write their own folder
CREATE POLICY "owner_select_vault" ON storage.objects FOR SELECT
  USING (bucket_id = 'vault-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner_insert_vault" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vault-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "owner_delete_vault" ON storage.objects FOR DELETE
  USING (bucket_id = 'vault-docs' AND auth.uid()::text = (storage.foldername(name))[1]);