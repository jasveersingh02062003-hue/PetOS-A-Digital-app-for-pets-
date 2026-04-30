-- ============================================================
-- Sprint M2: Nearby fanout + Vet directory + live mating listings
-- ============================================================

-- 1) Add service_bookings + mating_listings to realtime publication
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.service_bookings'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.mating_listings'; exception when others then null; end;
end $$;
alter table public.service_bookings replica identity full;
alter table public.mating_listings replica identity full;

-- 2) Generic helper: notify every nearby user with a single notifications insert
-- Uses profiles.lat/lng + haversine_km. Caps recipients to 500 to prevent spam.
create or replace function public.fanout_nearby(
  _actor uuid,
  _lat double precision,
  _lng double precision,
  _radius_km double precision,
  _kind text,
  _title text,
  _body text,
  _link text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if _lat is null or _lng is null then return 0; end if;
  with recipients as (
    select p.id
    from public.profiles p
    where p.id is not null
      and p.id <> coalesce(_actor, '00000000-0000-0000-0000-000000000000'::uuid)
      and p.lat is not null and p.lng is not null
      and public.haversine_km(_lat, _lng, p.lat::double precision, p.lng::double precision) <= _radius_km
    order by public.haversine_km(_lat, _lng, p.lat::double precision, p.lng::double precision) asc
    limit 500
  )
  insert into public.notifications (user_id, type, title, body, link)
  select id, _kind, _title, _body, _link from recipients;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.fanout_nearby(uuid, double precision, double precision, double precision, text, text, text, text) from public;
grant execute on function public.fanout_nearby(uuid, double precision, double precision, double precision, text, text, text, text) to service_role;

-- 3) Trigger: new active mating listing → fanout 25 km
create or replace function public.tg_mating_listing_nearby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat numeric; v_lng numeric;
  v_breed text; v_species text; v_pet_name text;
  v_owner_city text;
begin
  if NEW.active is not true then return NEW; end if;

  select pr.lat, pr.lng, pe.breed, pe.species::text, pe.name
    into v_lat, v_lng, v_breed, v_species, v_pet_name
  from public.pets pe
  left join public.profiles pr on pr.id = pe.owner_id
  where pe.id = NEW.pet_id;

  if v_lat is null or v_lng is null then return NEW; end if;

  perform public.fanout_nearby(
    NEW.owner_id,
    v_lat::double precision, v_lng::double precision,
    25,
    'mate_nearby',
    'New mate nearby',
    coalesce(v_breed, v_species, 'A pet') || ' looking for a match',
    '/mates/' || NEW.id::text);
  return NEW;
end $$;

drop trigger if exists trg_mating_listing_nearby on public.mating_listings;
create trigger trg_mating_listing_nearby
  after insert on public.mating_listings
  for each row execute function public.tg_mating_listing_nearby();

-- 4) Trigger: new active adoption listing → fanout 25 km
create or replace function public.tg_pet_listing_nearby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat numeric; v_lng numeric;
begin
  if NEW.active is not true or NEW.listing_type::text not in ('adoption', 'rehoming') then
    return NEW;
  end if;

  -- Prefer listing's own coords, fall back to owner profile
  v_lat := NEW.lat;
  v_lng := NEW.lng;
  if v_lat is null or v_lng is null then
    select lat, lng into v_lat, v_lng from public.profiles where id = NEW.owner_id;
  end if;
  if v_lat is null or v_lng is null then return NEW; end if;

  perform public.fanout_nearby(
    NEW.owner_id,
    v_lat::double precision, v_lng::double precision,
    25,
    'adopt_nearby',
    'New pet up for adoption',
    coalesce(NEW.breed, NEW.species, 'A pet') || ' near you',
    '/adopt/' || NEW.id::text);
  return NEW;
end $$;

drop trigger if exists trg_pet_listing_nearby on public.pet_listings;
create trigger trg_pet_listing_nearby
  after insert on public.pet_listings
  for each row execute function public.tg_pet_listing_nearby();

-- 5) Trigger: new active service provider → fanout 15 km
create or replace function public.tg_provider_nearby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.active is not true then return NEW; end if;
  if NEW.lat is null or NEW.lng is null then return NEW; end if;

  perform public.fanout_nearby(
    NEW.owner_id,
    NEW.lat::double precision, NEW.lng::double precision,
    15,
    'provider_nearby',
    'New ' || coalesce(NEW.category::text, 'service') || ' nearby',
    coalesce(NEW.name, 'A new provider') || ' just joined Petos',
    '/services/' || NEW.id::text);
  return NEW;
end $$;

drop trigger if exists trg_provider_nearby on public.service_providers;
create trigger trg_provider_nearby
  after insert on public.service_providers
  for each row execute function public.tg_provider_nearby();

-- 6) Vet directory RPC (location-aware, with specialty + 24/7 filters)
create or replace function public.discover_vets(
  _lat double precision default null,
  _lng double precision default null,
  _specialty text default null,
  _open_24_7 boolean default false,
  _radius_km double precision default 50,
  _limit integer default 50)
returns table (
  user_id uuid,
  display_name text,
  photo_url text,
  bio text,
  clinic_name text,
  city text,
  address text,
  phone text,
  lat numeric,
  lng numeric,
  specialisations text[],
  rating_avg double precision,
  rating_count integer,
  price_video_inr integer,
  price_clinic_inr integer,
  distance_km double precision)
language sql stable security definer set search_path = public as $$
  select
    v.user_id,
    v.display_name,
    v.photo_url,
    v.bio,
    v.clinic_name,
    v.city,
    v.address,
    v.phone,
    v.lat,
    v.lng,
    v.specialisations,
    coalesce(v.rating_avg, 0)::double precision as rating_avg,
    coalesce(v.rating_count, 0)::int as rating_count,
    v.price_video_inr,
    v.price_clinic_inr,
    public.haversine_km(_lat, _lng, v.lat::double precision, v.lng::double precision) as distance_km
  from public.vet_profiles v
  where v.active = true
    and v.onboarded = true
    and (_specialty is null or _specialty = any(coalesce(v.specialisations, '{}'::text[])))
    and (not _open_24_7 or '24x7' = any(coalesce(v.specialisations, '{}'::text[])))
    and (_lat is null or _lng is null or v.lat is null or v.lng is null
         or public.haversine_km(_lat, _lng, v.lat::double precision, v.lng::double precision) <= _radius_km)
  order by
    case when _lat is null or _lng is null or v.lat is null or v.lng is null then 1 else 0 end,
    public.haversine_km(_lat, _lng, v.lat::double precision, v.lng::double precision) asc nulls last,
    coalesce(v.rating_avg, 0) desc
  limit greatest(1, least(_limit, 100));
$$;
grant execute on function public.discover_vets(double precision, double precision, text, boolean, double precision, integer) to authenticated, anon;

-- 7) Breeder stats view (last_active + response_rate)
create or replace view public.breeder_stats as
select
  u.id as user_id,
  u.last_sign_in_at as last_active_at,
  coalesce(rs.total_requests, 0) as total_requests,
  coalesce(rs.accepted_requests, 0) as accepted_requests,
  case
    when coalesce(rs.total_requests, 0) = 0 then null
    else round((rs.accepted_requests::numeric / rs.total_requests::numeric) * 100, 0)
  end as response_rate_pct
from auth.users u
left join (
  select
    to_owner_id,
    count(*) as total_requests,
    count(*) filter (where status::text in ('accepted','approved','confirmed','agreed')) as accepted_requests
  from public.mating_requests
  group by to_owner_id
) rs on rs.to_owner_id = u.id;

-- The view uses auth.users (last_sign_in_at), so wrap in a definer function for safe public read.
create or replace function public.get_breeder_stats(_user_id uuid)
returns table (
  user_id uuid,
  last_active_at timestamptz,
  total_requests bigint,
  accepted_requests bigint,
  response_rate_pct numeric)
language sql stable security definer set search_path = public as $$
  select user_id, last_active_at, total_requests, accepted_requests, response_rate_pct
  from public.breeder_stats
  where user_id = _user_id;
$$;
revoke all on function public.get_breeder_stats(uuid) from public;
grant execute on function public.get_breeder_stats(uuid) to authenticated;