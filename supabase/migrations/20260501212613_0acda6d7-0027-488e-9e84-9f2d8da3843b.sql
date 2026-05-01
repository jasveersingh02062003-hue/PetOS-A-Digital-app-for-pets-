
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
