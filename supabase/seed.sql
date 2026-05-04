-- Seed data for Petos Development Environment
-- Passwords for all accounts are 'password123'

-- Enable necessary extensions if not present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Insert into auth.users (simulate signup)
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, is_super_admin)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'admin@petos.com', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Admin User"}', NOW(), NOW(), 'authenticated', false),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'breeder@petos.com', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elite Breeders"}', NOW(), NOW(), 'authenticated', false),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'vet@petos.com', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Dr. PetVet"}', NOW(), NOW(), 'authenticated', false),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'user@petos.com', crypt('password123', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name":"Pet Parent"}', NOW(), NOW(), 'authenticated', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert into public.profiles (simulating what triggers would do, or updating existing ones)
INSERT INTO public.profiles (id, full_name, avatar_url, handle, setup_completed, bio)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Admin User', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin', 'admin', true, 'System Administrator'),
  ('22222222-2222-2222-2222-222222222222', 'Elite Breeders', 'https://api.dicebear.com/7.x/avataaars/svg?seed=breeder', 'elite_breeders', true, 'Professional dog breeders specializing in Golden Retrievers.'),
  ('33333333-3333-3333-3333-333333333333', 'Dr. PetVet', 'https://api.dicebear.com/7.x/avataaars/svg?seed=vet', 'dr_petvet', true, 'Certified veterinary professional.'),
  ('44444444-4444-4444-4444-444444444444', 'Pet Parent', 'https://api.dicebear.com/7.x/avataaars/svg?seed=parent', 'pet_parent', true, 'Loving my pets.')
ON CONFLICT (id) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  handle = EXCLUDED.handle,
  setup_completed = EXCLUDED.setup_completed,
  bio = EXCLUDED.bio;

-- 3. Insert into public.user_roles
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'breeder'),
  ('33333333-3333-3333-3333-333333333333', 'vet')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Insert into public.pets
INSERT INTO public.pets (id, owner_id, name, species, breed, gender, date_of_birth, vaccination_verified, discoverable_for_mating, bio)
VALUES 
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'Maximus', 'dog', 'Golden Retriever', 'male', '2023-01-01', true, true, 'Friendly and energetic stud.'),
  ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'Luna', 'dog', 'Labrador', 'female', '2022-05-10', true, false, 'Sweet family dog.')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert into public.mating_listings
INSERT INTO public.mating_listings (id, owner_id, pet_id, status, description, price_amount)
VALUES 
  ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'active', 'Maximus is available for stud services to approved females.', 500)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert into public.posts
INSERT INTO public.posts (id, author_id, pet_id, content)
VALUES
  ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'Maximus just won best in show at the local dog event!'),
  ('99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', 'Luna enjoyed her walk in the park today.')
ON CONFLICT (id) DO NOTHING;
