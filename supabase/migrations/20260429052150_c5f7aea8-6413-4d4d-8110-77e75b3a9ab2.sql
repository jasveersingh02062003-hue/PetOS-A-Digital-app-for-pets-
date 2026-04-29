-- 1. subscriptions extensions
alter table public.subscriptions
  add column if not exists environment text not null default 'sandbox',
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists product_id text,
  add column if not exists price_id text,
  add column if not exists current_period_start timestamptz;

update public.subscriptions
   set stripe_subscription_id = coalesce(stripe_subscription_id, provider_subscription_id),
       stripe_customer_id     = coalesce(stripe_customer_id, provider_customer_id)
 where stripe_subscription_id is null or stripe_customer_id is null;

create unique index if not exists subscriptions_stripe_sub_env_uniq
  on public.subscriptions(stripe_subscription_id, environment)
  where stripe_subscription_id is not null;

-- 2. server-side Plus gate
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'sandbox'
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and tier = 'plus'
      and (
        (status in ('active','trialing') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end is not null and current_period_end > now())
      )
  );
$$;
grant execute on function public.has_active_subscription(uuid, text) to anon, authenticated;

-- 3. commission rates
create table if not exists public.commission_rates (
  kind text primary key,
  rate_pct numeric(5,2) not null check (rate_pct >= 0 and rate_pct <= 100),
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.commission_rates(kind, rate_pct, notes) values
  ('transport',   15, 'Pet taxi'),
  ('service',     12, 'Grooming, boarding, training'),
  ('appointment', 10, 'Vet appointment'),
  ('vet_consult', 10, 'Vet consult'),
  ('puppy',        8, 'Puppy sale')
on conflict (kind) do nothing;

alter table public.commission_rates enable row level security;
drop policy if exists "anyone reads commission rates" on public.commission_rates;
create policy "anyone reads commission rates"
  on public.commission_rates for select to authenticated using (true);

-- 4. provider payout ledger
create table if not exists public.provider_payouts (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null,
  payment_intent_id uuid not null references public.payment_intents(id) on delete cascade,
  kind text not null,
  ref_id uuid,
  gross_inr integer not null,
  commission_inr integer not null,
  net_inr integer not null,
  status text not null default 'pending' check (status in ('pending','paid','reversed')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_intent_id)
);

create index if not exists provider_payouts_provider_idx
  on public.provider_payouts(provider_user_id, created_at desc);

alter table public.provider_payouts enable row level security;

drop policy if exists "providers view own payouts" on public.provider_payouts;
create policy "providers view own payouts"
  on public.provider_payouts for select to authenticated
  using (auth.uid() = provider_user_id);

drop policy if exists "admins view all payouts" on public.provider_payouts;
create policy "admins view all payouts"
  on public.provider_payouts for select to authenticated
  using (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'moderator'));

-- 5. payout-creation trigger
create or replace function public.tg_create_provider_payout()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_provider uuid;
  v_kind     text := new.kind::text;
  v_rate     numeric(5,2);
  v_commission integer;
  v_net      integer;
begin
  if new.status <> 'paid' then return new; end if;
  if (tg_op = 'UPDATE' and old.status = 'paid') then return new; end if;
  if new.ref_id is null then return new; end if;

  if v_kind = 'transport' then
    select provider_id into v_provider from public.transport_bookings where id = new.ref_id;
  elsif v_kind = 'service' then
    select provider_id into v_provider from public.service_bookings where id = new.ref_id;
  elsif v_kind = 'appointment' then
    select vet_id into v_provider from public.appointments where id = new.ref_id;
  elsif v_kind = 'vet_consult' then
    select vet_id into v_provider from public.vet_consults where id = new.ref_id;
  else
    return new;
  end if;

  if v_provider is null then return new; end if;

  select rate_pct into v_rate from public.commission_rates where kind = v_kind;
  if v_rate is null then v_rate := 15; end if;

  v_commission := round(new.amount_inr * v_rate / 100.0);
  v_net        := new.amount_inr - v_commission;

  insert into public.provider_payouts(provider_user_id, payment_intent_id, kind, ref_id, gross_inr, commission_inr, net_inr)
  values (v_provider, new.id, v_kind, new.ref_id, new.amount_inr, v_commission, v_net)
  on conflict (payment_intent_id) do nothing;

  return new;
exception when others then
  raise warning 'tg_create_provider_payout failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists payment_intents_payout_trg on public.payment_intents;
create trigger payment_intents_payout_trg
  after insert or update of status on public.payment_intents
  for each row execute function public.tg_create_provider_payout();

-- 6. mating listing auto-activation on payment
create or replace function public.tg_activate_mating_listing()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.payment_intent_id is not null
     and (old.payment_intent_id is null or old.payment_intent_id <> new.payment_intent_id) then
    new.active := true;
    if new.paid_until is null or new.paid_until < now() then
      new.paid_until := now() + interval '30 days';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mating_listings_activate_trg on public.mating_listings;
create trigger mating_listings_activate_trg
  before update on public.mating_listings
  for each row execute function public.tg_activate_mating_listing();