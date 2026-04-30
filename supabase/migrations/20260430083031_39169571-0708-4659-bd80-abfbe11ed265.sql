-- M4: track when a 30-min pre-appointment reminder was sent so we don't double-send
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.service_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.transport_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_due_reminder
  ON public.appointments (scheduled_at)
  WHERE reminder_sent_at IS NULL AND status IN ('confirmed','requested');
CREATE INDEX IF NOT EXISTS idx_bookings_due_reminder
  ON public.service_bookings (scheduled_at)
  WHERE reminder_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transport_due_reminder
  ON public.transport_bookings (scheduled_at)
  WHERE reminder_sent_at IS NULL;