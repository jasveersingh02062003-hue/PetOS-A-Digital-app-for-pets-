
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
