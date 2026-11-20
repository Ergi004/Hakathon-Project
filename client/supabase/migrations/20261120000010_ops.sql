-- Operational tables referenced by SPEC 13.5 (email.ts outbox, rate-limit.ts),
-- realtime publication from SPEC 5 / 13.4, and function privilege hardening (SPEC 4:
-- "Anonymous visitors have no database access at all").

-- Simulated email outbox (SIMULATE_EMAIL=true logs here instead of sending)
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  subject text not null,
  body text not null,
  kind text not null default 'generic',          -- takedown_notice, invite, simulation, alert, generic
  entity text,
  entity_id text,
  simulated boolean not null default true,
  sent_at timestamptz not null default now()
);
create index on public.outbox (sent_at desc);
alter table public.outbox enable row level security;
create policy outbox_staff_read on public.outbox for select to authenticated using (public.is_staff());

-- Table-backed rate limiting. Only the server (secret key) touches it: RLS on, no policies.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- Atomically records one hit and reports whether the caller is still under the limit.
create function public.rate_limit_hit(p_key text, p_window_sec int, p_max int)
returns table (allowed boolean, current_hits int, reset_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return query select v_hits <= p_max, v_hits, v_start + make_interval(secs => p_window_sec);
end $$;

-- Function privileges: nothing for anon; policy helpers for authenticated; server for the rest.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.platform_role(), public.is_staff(), public.is_lead(), public.is_admin(),
  public.org_role(uuid), public.is_org_member(uuid), public.next_protocol()
  to authenticated;
revoke execute on function public.rate_limit_hit(text, int, int) from authenticated;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Realtime (SPEC 13.4). RLS applies to Realtime subscribers.
alter publication supabase_realtime add table public.reports, public.notifications, public.takedown_notices, public.campaigns;
