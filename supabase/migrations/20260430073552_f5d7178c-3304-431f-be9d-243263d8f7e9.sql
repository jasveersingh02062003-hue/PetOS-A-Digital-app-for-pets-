-- =========================================================
-- Phase I: Cross-actor workflows
-- =========================================================

-- 1) walk_events: walker-side logs during a walk
do $$ begin
  if not exists (select 1 from pg_type where typname = 'walk_event_kind') then
    create type public.walk_event_kind as enum ('health_flag','behavior_note','photo','geo_ping');
  end if;
end $$;

create table if not exists public.walk_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.service_bookings(id) on delete cascade,
  author_id uuid not null,
  kind public.walk_event_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_walk_events_booking on public.walk_events(booking_id, created_at desc);

alter table public.walk_events enable row level security;

-- Walker (provider owner) and customer can read events for their booking
drop policy if exists "walk_events_select_party" on public.walk_events;
create policy "walk_events_select_party" on public.walk_events
for select to authenticated
using (
  exists (
    select 1 from public.service_bookings b
    left join public.service_providers p on p.id = b.provider_id
    where b.id = walk_events.booking_id
      and (b.customer_id = auth.uid() or p.owner_id = auth.uid())
  )
);

-- Only the assigned walker (provider owner) can insert
drop policy if exists "walk_events_insert_walker" on public.walk_events;
create policy "walk_events_insert_walker" on public.walk_events
for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.service_bookings b
    join public.service_providers p on p.id = b.provider_id
    where b.id = walk_events.booking_id and p.owner_id = auth.uid()
  )
);

-- =========================================================
-- 2) booking_suggestions: owner-side "next action" inbox
-- =========================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'booking_suggestion_kind') then
    create type public.booking_suggestion_kind as enum ('vet_followup','wellness_check','grooming','training','dental');
  end if;
end $$;

create table if not exists public.booking_suggestions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  pet_id uuid,
  kind public.booking_suggestion_kind not null,
  reason text not null,
  source_walk_event_id uuid references public.walk_events(id) on delete set null,
  source_booking_id uuid references public.service_bookings(id) on delete set null,
  deep_link text,
  status text not null default 'open' check (status in ('open','dismissed','booked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_booking_suggestions_owner_open
  on public.booking_suggestions(owner_id, status, created_at desc);

alter table public.booking_suggestions enable row level security;

drop policy if exists "bsugg_select_own" on public.booking_suggestions;
create policy "bsugg_select_own" on public.booking_suggestions
for select to authenticated using (owner_id = auth.uid());

drop policy if exists "bsugg_update_own" on public.booking_suggestions;
create policy "bsugg_update_own" on public.booking_suggestions
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Insertion is system-driven (SECURITY DEFINER trigger), so no client INSERT policy.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_bsugg_updated on public.booking_suggestions;
create trigger trg_bsugg_updated before update on public.booking_suggestions
for each row execute function public.set_updated_at();

-- =========================================================
-- 3) Trigger: health_flag walk_event → suggestion + notification
-- =========================================================
create or replace function public.tg_walk_event_to_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_pet uuid;
  v_reason text;
begin
  if new.kind <> 'health_flag' then
    return new;
  end if;

  select b.customer_id, (b.pet_ids)[1]
    into v_owner, v_pet
  from public.service_bookings b
  where b.id = new.booking_id;

  if v_owner is null then
    return new;
  end if;

  v_reason := coalesce(
    nullif(trim(new.payload->>'note'), ''),
    'Walker flagged a health concern during the walk.'
  );

  insert into public.booking_suggestions
    (owner_id, pet_id, kind, reason, source_walk_event_id, source_booking_id, deep_link)
  values
    (v_owner, v_pet, 'vet_followup', v_reason, new.id, new.booking_id,
     '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, ''));

  insert into public.notifications (user_id, actor_id, type, title, body, link)
  values (
    v_owner,
    new.author_id,
    'walk_health_flag',
    'Health flag during walk',
    v_reason,
    '/services/vet?source=walk_flag&pet=' || coalesce(v_pet::text, '')
  );

  return new;
end;
$$;

drop trigger if exists trg_walk_event_to_suggestion on public.walk_events;
create trigger trg_walk_event_to_suggestion
after insert on public.walk_events
for each row execute function public.tg_walk_event_to_suggestion();

-- =========================================================
-- 4) Caretaker: optional wellness score on daily reports
-- =========================================================
alter table public.kennel_daily_reports
  add column if not exists wellness_score smallint check (wellness_score between 1 and 5);