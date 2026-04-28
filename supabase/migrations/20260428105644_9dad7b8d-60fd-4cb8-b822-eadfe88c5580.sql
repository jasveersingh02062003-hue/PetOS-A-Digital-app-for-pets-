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