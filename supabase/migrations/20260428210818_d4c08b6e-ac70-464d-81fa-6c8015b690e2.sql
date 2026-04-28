create table if not exists public.walk_summaries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.service_bookings(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null default 0,
  distance_km numeric(8,3) not null default 0,
  point_count integer not null default 0,
  avg_pace_min_per_km numeric(8,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_walk_summaries_booking on public.walk_summaries(booking_id);

alter table public.walk_summaries enable row level security;

drop policy if exists "participants read summary" on public.walk_summaries;
create policy "participants read summary"
  on public.walk_summaries for select
  using (
    exists (
      select 1 from public.service_bookings sb
      left join public.service_providers sp on sp.id = sb.provider_id
      where sb.id = walk_summaries.booking_id
        and (sb.customer_id = auth.uid() or sp.owner_id = auth.uid())
    )
  );

drop policy if exists "walker writes summary" on public.walk_summaries;
create policy "walker writes summary"
  on public.walk_summaries for insert
  with check (
    exists (
      select 1 from public.service_bookings sb
      join public.service_providers sp on sp.id = sb.provider_id
      where sb.id = walk_summaries.booking_id
        and sp.owner_id = auth.uid()
    )
  );

drop policy if exists "walker updates summary" on public.walk_summaries;
create policy "walker updates summary"
  on public.walk_summaries for update
  using (
    exists (
      select 1 from public.service_bookings sb
      join public.service_providers sp on sp.id = sb.provider_id
      where sb.id = walk_summaries.booking_id
        and sp.owner_id = auth.uid()
    )
  );