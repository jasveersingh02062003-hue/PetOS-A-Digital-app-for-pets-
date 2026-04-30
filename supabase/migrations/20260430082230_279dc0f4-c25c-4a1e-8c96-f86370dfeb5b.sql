-- Fix: drop the view that exposed auth.users; keep behaviour in the function only.
drop view if exists public.breeder_stats;

create or replace function public.get_breeder_stats(_user_id uuid)
returns table (
  user_id uuid,
  last_active_at timestamptz,
  total_requests bigint,
  accepted_requests bigint,
  response_rate_pct numeric)
language sql stable security definer set search_path = public, auth as $$
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
    where to_owner_id = _user_id
    group by to_owner_id
  ) rs on rs.to_owner_id = u.id
  where u.id = _user_id;
$$;
revoke all on function public.get_breeder_stats(uuid) from public;
grant execute on function public.get_breeder_stats(uuid) to authenticated;