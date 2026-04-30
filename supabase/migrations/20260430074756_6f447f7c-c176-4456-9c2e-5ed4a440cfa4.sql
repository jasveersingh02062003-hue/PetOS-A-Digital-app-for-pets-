
-- =====================================================================
-- Phase J (corrected) — bidding, geofencing, nearest-first everywhere
-- =====================================================================

-- 1) helpers
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe set search_path = public as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371.0 * 2.0 * asin(
      sqrt(
        power(sin(radians((lat2 - lat1)/2.0)),2) +
        cos(radians(lat1))*cos(radians(lat2))*
        power(sin(radians((lng2 - lng1)/2.0)),2)
      )
    )
  end
$$;

create or replace function public.composite_score(
  distance_km double precision,
  rating double precision,
  review_count integer,
  freshness_days double precision,
  boost double precision
) returns double precision
language sql immutable parallel safe set search_path = public as $$
  select
      coalesce(rating, 3.5) * 1.5
    + ln(coalesce(review_count, 0) + 1) * 0.4
    + coalesce(boost, 0) * 1.2
    - coalesce(distance_km, 25.0) * 0.08
    - least(coalesce(freshness_days, 0), 90.0) * 0.01
$$;

-- 2) taxi_bids
do $$ begin
  if not exists (select 1 from pg_type where typname='taxi_bid_status') then
    create type public.taxi_bid_status as enum ('open','accepted','rejected','withdrawn');
  end if;
end $$;

create table if not exists public.taxi_bids (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.transport_bookings(id) on delete cascade,
  driver_provider_id uuid not null references public.service_providers(id) on delete cascade,
  driver_user_id uuid not null,
  price_inr integer not null check (price_inr > 0),
  eta_minutes integer not null check (eta_minutes > 0 and eta_minutes <= 240),
  distance_km numeric(6,2),
  note text,
  status public.taxi_bid_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, driver_provider_id)
);
create index if not exists idx_taxi_bids_booking on public.taxi_bids(booking_id, status);
create index if not exists idx_taxi_bids_driver  on public.taxi_bids(driver_user_id, created_at desc);

alter table public.taxi_bids enable row level security;

drop policy if exists "tb_driver_insert" on public.taxi_bids;
create policy "tb_driver_insert" on public.taxi_bids
for insert to authenticated
with check (
  driver_user_id = auth.uid()
  and exists (
    select 1 from public.service_providers p
    where p.id = taxi_bids.driver_provider_id
      and p.owner_id = auth.uid()
      and p.category = 'pet_taxi'
      and p.active = true
  )
  and exists (
    select 1 from public.transport_bookings b
    where b.id = taxi_bids.booking_id and b.status = 'requested'
  )
);

drop policy if exists "tb_driver_select_own" on public.taxi_bids;
create policy "tb_driver_select_own" on public.taxi_bids
for select to authenticated using (driver_user_id = auth.uid());

drop policy if exists "tb_customer_select_on_trip" on public.taxi_bids;
create policy "tb_customer_select_on_trip" on public.taxi_bids
for select to authenticated using (
  exists (select 1 from public.transport_bookings b
          where b.id = taxi_bids.booking_id and b.customer_id = auth.uid())
);

drop policy if exists "tb_driver_update_own" on public.taxi_bids;
create policy "tb_driver_update_own" on public.taxi_bids
for update to authenticated
using (driver_user_id = auth.uid())
with check (driver_user_id = auth.uid());

drop policy if exists "tb_customer_update_on_trip" on public.taxi_bids;
create policy "tb_customer_update_on_trip" on public.taxi_bids
for update to authenticated
using (exists (select 1 from public.transport_bookings b
               where b.id = taxi_bids.booking_id and b.customer_id = auth.uid()));

drop trigger if exists trg_taxi_bids_updated on public.taxi_bids;
create trigger trg_taxi_bids_updated before update on public.taxi_bids
for each row execute function public.set_updated_at();

alter table public.taxi_bids replica identity full;
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.taxi_bids';
  exception when others then null; end;
end $$;

-- 3) bid notifications
create or replace function public.tg_taxi_bid_notify_customer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_customer uuid; v_driver_name text;
begin
  select customer_id into v_customer from public.transport_bookings where id = new.booking_id;
  if v_customer is null then return new; end if;
  select coalesce(p.name,'A driver') into v_driver_name
    from public.service_providers p where p.id = new.driver_provider_id;
  insert into public.notifications(user_id, actor_id, type, title, body, link)
  values (v_customer, new.driver_user_id, 'taxi_bid_received',
          'New driver bid',
          v_driver_name || ' · ₹' || new.price_inr || ' · ETA ' || new.eta_minutes || ' min',
          '/taxi/' || new.booking_id::text);
  return new;
end $$;

drop trigger if exists trg_taxi_bid_notify_customer on public.taxi_bids;
create trigger trg_taxi_bid_notify_customer
after insert on public.taxi_bids
for each row execute function public.tg_taxi_bid_notify_customer();

create or replace function public.tg_taxi_bid_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status='accepted' and (old.status is distinct from 'accepted') then
    update public.transport_bookings
       set provider_id = new.driver_provider_id,
           fare_inr = coalesce(fare_inr, new.price_inr),
           status = 'accepted'
     where id = new.booking_id and status = 'requested';

    for r in
      select id, driver_user_id from public.taxi_bids
      where booking_id = new.booking_id and id <> new.id and status='open'
    loop
      update public.taxi_bids set status='rejected' where id = r.id;
      insert into public.notifications(user_id, actor_id, type, title, body, link)
      values (r.driver_user_id, null, 'taxi_bid_rejected',
              'Trip taken','Another driver was selected for this trip.','/driver/taxi');
    end loop;

    insert into public.notifications(user_id, actor_id, type, title, body, link)
    values (new.driver_user_id, null, 'taxi_bid_accepted',
            'You got the trip!','Open the trip to start the pickup.',
            '/taxi/' || new.booking_id::text);
  end if;
  return new;
end $$;

drop trigger if exists trg_taxi_bid_accepted on public.taxi_bids;
create trigger trg_taxi_bid_accepted
after update on public.taxi_bids
for each row execute function public.tg_taxi_bid_accepted();

-- 4) geofence on driver location update
alter table public.transport_bookings
  add column if not exists pickup_arrival_notified_at timestamptz,
  add column if not exists dropoff_arrival_notified_at timestamptz;

create or replace function public.tg_transport_arrival_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_d_pickup double precision; v_d_drop double precision;
begin
  if new.driver_lat is null or new.driver_lng is null then return new; end if;

  if new.pickup_lat is not null and new.pickup_arrival_notified_at is null then
    v_d_pickup := public.haversine_km(
      new.driver_lat::double precision, new.driver_lng::double precision,
      new.pickup_lat::double precision, new.pickup_lng::double precision);
    if v_d_pickup is not null and v_d_pickup <= 0.2 then
      insert into public.notifications(user_id,actor_id,type,title,body,link)
      values (new.customer_id,null,'taxi_driver_arrived',
              'Your driver is here','Driver is at the pickup point.',
              '/taxi/'||new.id::text);
      new.pickup_arrival_notified_at := now();
    end if;
  end if;

  if new.dropoff_lat is not null and new.dropoff_arrival_notified_at is null then
    v_d_drop := public.haversine_km(
      new.driver_lat::double precision, new.driver_lng::double precision,
      new.dropoff_lat::double precision, new.dropoff_lng::double precision);
    if v_d_drop is not null and v_d_drop <= 0.2 then
      insert into public.notifications(user_id,actor_id,type,title,body,link)
      values (new.customer_id,null,'taxi_drop_near',
              'Almost at drop-off','Your pet is nearly home.',
              '/taxi/'||new.id::text);
      new.dropoff_arrival_notified_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_transport_arrival_check on public.transport_bookings;
create trigger trg_transport_arrival_check
before update of driver_lat, driver_lng on public.transport_bookings
for each row execute function public.tg_transport_arrival_check();

-- 5) Discover RPCs (nearest-first)

create or replace function public.discover_providers(
  _lat double precision default null, _lng double precision default null,
  _category text default null, _city text default null,
  _radius_km double precision default 50, _limit integer default 50)
returns table (
  id uuid, owner_id uuid, name text, category text, city text, bio text,
  hourly_rate_inr integer, cover_url text, verified boolean,
  lat numeric, lng numeric, next_available_at timestamptz,
  rating double precision, review_count integer,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with rated as (
    select p.id,
      coalesce(avg(r.rating)::double precision,0) as rating,
      count(r.id)::int as review_count
    from public.service_providers p
    left join public.reviews r on r.subject_type='provider' and r.subject_id=p.id
    group by p.id)
  select p.id, p.owner_id, p.name, p.category::text, p.city, p.bio,
         p.hourly_rate_inr, p.cover_url, p.verified, p.lat, p.lng, p.next_available_at,
         rt.rating, rt.review_count,
         public.haversine_km(_lat,_lng,p.lat::double precision,p.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,p.lat::double precision,p.lng::double precision),
           rt.rating, rt.review_count,
           extract(epoch from (now()-p.created_at))/86400.0,
           case when p.verified then 0.6 else 0 end) as score
  from public.service_providers p
  join rated rt on rt.id=p.id
  where p.active=true
    and (_category is null or p.category::text=_category)
    and (_city is null or p.city ilike _city)
    and (_lat is null or _lng is null or p.lat is null or p.lng is null
         or public.haversine_km(_lat,_lng,p.lat::double precision,p.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_providers(double precision,double precision,text,text,double precision,integer) to authenticated, anon;

create or replace function public.discover_mating_listings(
  _lat double precision default null, _lng double precision default null,
  _species text default null, _breed text default null, _city text default null,
  _radius_km double precision default 100, _limit integer default 50)
returns table (
  id uuid, pet_id uuid, owner_id uuid, intent text, fee_inr integer,
  city text, description text,
  pet_name text, pet_breed text, pet_avatar text,
  pet_lat numeric, pet_lng numeric, vaccination_verified boolean,
  rating double precision, review_count integer,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with rated as (
    select p.id,
      coalesce(avg(r.rating)::double precision,0) as rating,
      count(r.id)::int as review_count
    from public.pets p
    left join public.reviews r on r.subject_type='pet_partner' and r.subject_id=p.id
    group by p.id),
  pet_loc as (
    select pe.id as pet_id, pr.lat, pr.lng
    from public.pets pe
    left join public.profiles pr on pr.id=pe.owner_id)
  select ml.id, ml.pet_id, ml.owner_id, ml.intent::text, ml.fee_inr, ml.city, ml.description,
         pe.name, pe.breed, pe.avatar_url,
         pl.lat, pl.lng, pe.vaccination_verified,
         rt.rating, rt.review_count,
         public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision),
           rt.rating, rt.review_count,
           extract(epoch from (now()-ml.created_at))/86400.0,
             (case when pe.vaccination_verified then 0.4 else 0 end)
           + (case when ml.featured then 0.5 else 0 end)
           + (case when _species is not null and pe.species::text=_species then 0.5 else 0 end)
           + (case when _breed is not null and pe.breed ilike _breed then 0.6 else 0 end)) as score
  from public.mating_listings ml
  join public.pets pe on pe.id=ml.pet_id
  join pet_loc pl on pl.pet_id=pe.id
  join rated rt on rt.id=pe.id
  where ml.active=true
    and (_species is null or pe.species::text=_species)
    and (_city is null or ml.city ilike _city)
    and (_lat is null or _lng is null or pl.lat is null or pl.lng is null
         or public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_mating_listings(double precision,double precision,text,text,text,double precision,integer) to authenticated, anon;

create or replace function public.discover_shop_products(
  _lat double precision default null, _lng double precision default null,
  _category text default null, _query text default null,
  _radius_km double precision default 200, _limit integer default 50)
returns table (
  id uuid, seller_id uuid, title text, description text, category text,
  price_inr integer, stock integer, image_url text,
  seller_lat numeric, seller_lng numeric,
  rating double precision, review_count integer,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with seller_loc as (select id, lat, lng from public.profiles),
  rated as (
    select sp.id,
      coalesce(avg(r.rating)::double precision,0) as rating,
      count(r.id)::int as review_count
    from public.shop_products sp
    left join public.reviews r on r.subject_type='product' and r.subject_id=sp.id
    group by sp.id)
  select sp.id, sp.seller_id, sp.title, sp.description, sp.category::text,
         sp.price_inr, sp.stock, sp.image_url, sl.lat, sl.lng,
         rt.rating, rt.review_count,
         public.haversine_km(_lat,_lng,sl.lat::double precision,sl.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,sl.lat::double precision,sl.lng::double precision),
           rt.rating, rt.review_count,
           extract(epoch from (now()-sp.created_at))/86400.0,
           case when sp.stock>0 then 0.4 else -0.5 end) as score
  from public.shop_products sp
  left join seller_loc sl on sl.id=sp.seller_id
  join rated rt on rt.id=sp.id
  where sp.active=true
    and (_category is null or sp.category::text=_category)
    and (_query is null or sp.title ilike '%'||_query||'%' or sp.description ilike '%'||_query||'%')
    and (_lat is null or _lng is null or sl.lat is null or sl.lng is null
         or public.haversine_km(_lat,_lng,sl.lat::double precision,sl.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_shop_products(double precision,double precision,text,text,double precision,integer) to authenticated, anon;

create or replace function public.discover_pets_for_adoption(
  _lat double precision default null, _lng double precision default null,
  _species text default null, _city text default null,
  _radius_km double precision default 200, _limit integer default 50)
returns table (
  id uuid, owner_id uuid, name text, species text, breed text,
  avatar_url text, city text, lat numeric, lng numeric,
  vaccination_verified boolean, is_org boolean,
  distance_km double precision, score double precision)
language sql stable security definer set search_path=public as $$
  with pet_loc as (
    select pe.id as pet_id, pr.lat, pr.lng,
           exists(select 1 from public.org_profiles op
                  where op.user_id=pe.owner_id and op.status='verified') as is_org
    from public.pets pe
    left join public.profiles pr on pr.id=pe.owner_id)
  select pe.id, pe.owner_id, pe.name, pe.species::text, pe.breed, pe.avatar_url, pe.city,
         pl.lat, pl.lng, pe.vaccination_verified, pl.is_org,
         public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) as distance_km,
         public.composite_score(
           public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision),
           0, 0,
           extract(epoch from (now()-pe.created_at))/86400.0,
             (case when pl.is_org then 0.7 else 0 end)
           + (case when pe.vaccination_verified then 0.3 else 0 end)) as score
  from public.pets pe
  join pet_loc pl on pl.pet_id=pe.id
  where pe.discoverable_for_mating = true
    and (_species is null or pe.species::text=_species)
    and (_city is null or pe.city ilike _city)
    and (_lat is null or _lng is null or pl.lat is null or pl.lng is null
         or public.haversine_km(_lat,_lng,pl.lat::double precision,pl.lng::double precision) <= _radius_km)
  order by score desc nulls last
  limit greatest(1, least(_limit,100));
$$;
grant execute on function public.discover_pets_for_adoption(double precision,double precision,text,text,double precision,integer) to authenticated, anon;
