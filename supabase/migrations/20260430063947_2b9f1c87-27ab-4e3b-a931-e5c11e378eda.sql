drop policy if exists pet_listings_select_active_anon on public.pet_listings;
create policy pet_listings_select_active_anon
  on public.pet_listings for select to anon
  using (active = true and status = 'active'::pet_listing_status);

drop policy if exists listings_select_active_anon on public.mating_listings;
create policy listings_select_active_anon
  on public.mating_listings for select to anon
  using (active = true);

drop policy if exists providers_select_active_anon on public.service_providers;
create policy providers_select_active_anon
  on public.service_providers for select to anon
  using (active = true);

drop view if exists public.service_providers_public cascade;
create view public.service_providers_public with (security_invoker = true) as
  select id, owner_id, name, category, city, bio, hourly_rate_inr, cover_url,
    verified, active, contact_phone, lat, lng, trust_status, years_experience,
    service_radius_km, languages, days_available, time_slots,
    accepting_jobs, verification_status, details, created_at
  from public.service_providers
  where active = true;
grant select on public.service_providers_public to anon, authenticated;

drop policy if exists org_profiles_select_approved_anon on public.org_profiles;
create policy org_profiles_select_approved_anon
  on public.org_profiles for select to anon
  using (status = 'approved');

drop view if exists public.org_profiles_public cascade;
create view public.org_profiles_public with (security_invoker = true) as
  select user_id, org_name, org_type, city, state, lat, lng,
    website, description, facility_photos, donation_upi, donation_url,
    status, total_donations_inr, donor_count, created_at
  from public.org_profiles
  where status = 'approved';
grant select on public.org_profiles_public to anon, authenticated;

grant execute on function public.get_profile_public_by_ref(text) to anon;
grant execute on function public.get_pet_public_by_ref(text) to anon;
grant execute on function public.get_pets_public() to anon;