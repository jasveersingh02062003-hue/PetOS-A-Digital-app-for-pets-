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