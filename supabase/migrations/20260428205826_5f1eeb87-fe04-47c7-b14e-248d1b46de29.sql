ALTER TABLE public.symptom_logs
  ADD COLUMN IF NOT EXISTS ai_flag TEXT CHECK (ai_flag IN ('watch','vet_soon','emergency')),
  ADD COLUMN IF NOT EXISTS ai_reason TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_symptom_logs_pet_flag
  ON public.symptom_logs(pet_id, ai_flag) WHERE ai_flag IS NOT NULL;