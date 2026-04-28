
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
