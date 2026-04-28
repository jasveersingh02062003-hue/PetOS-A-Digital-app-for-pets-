alter table public.appointments
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists actual_duration_min integer,
  add column if not exists vet_visit_notes text;

create index if not exists idx_appointments_vet_status on public.appointments(vet_id, status);