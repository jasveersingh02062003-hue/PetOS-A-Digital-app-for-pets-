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