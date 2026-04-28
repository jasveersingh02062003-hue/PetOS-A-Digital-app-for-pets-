
ALTER TABLE public.reminder_log DROP CONSTRAINT IF EXISTS reminder_log_pkey;

ALTER TABLE public.reminder_log
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS ref_id uuid,
  ALTER COLUMN vaccination_id DROP NOT NULL;

UPDATE public.reminder_log SET ref_id = vaccination_id WHERE ref_id IS NULL AND vaccination_id IS NOT NULL;

ALTER TABLE public.reminder_log ADD PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_kind_ref_uidx
  ON public.reminder_log (kind, ref_id)
  WHERE ref_id IS NOT NULL;
