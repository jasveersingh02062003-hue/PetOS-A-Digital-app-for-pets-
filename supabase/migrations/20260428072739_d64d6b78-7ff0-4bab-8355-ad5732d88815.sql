ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notify_plus_launch boolean NOT NULL DEFAULT false;