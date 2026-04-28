create table if not exists public.health_insights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null,
  summary text not null,
  insights jsonb not null default '[]'::jsonb,
  data_signature text,
  generated_at timestamptz not null default now(),
  model text,
  unique (pet_id)
);

create index if not exists idx_health_insights_owner on public.health_insights(owner_id);

alter table public.health_insights enable row level security;

drop policy if exists "owner reads own insights" on public.health_insights;
create policy "owner reads own insights"
  on public.health_insights for select
  using (auth.uid() = owner_id);

drop policy if exists "owner deletes own insights" on public.health_insights;
create policy "owner deletes own insights"
  on public.health_insights for delete
  using (auth.uid() = owner_id);

drop policy if exists "vets in care team read insights" on public.health_insights;
create policy "vets in care team read insights"
  on public.health_insights for select
  using (public.vet_can_read_pet(pet_id));