-- SPEC 10 A2 "saved views" and A14 "list of fired alerts".

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null default 'inbox' check (scope in ('inbox','campaigns','domains','takedowns')),
  name text not null check (length(name) between 1 and 60),
  filters jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, scope, name)
);
alter table public.saved_views enable row level security;
create policy saved_views_owner on public.saved_views for all to authenticated
  using (user_id = (select auth.uid()) and public.is_staff()) with check (user_id = (select auth.uid()) and public.is_staff());

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.alert_rules(id) on delete cascade,
  value numeric not null,
  data jsonb not null default '{}',
  fired_at timestamptz not null default now()
);
create index on public.alert_events (fired_at desc);
alter table public.alert_events enable row level security;
create policy alert_events_staff_read on public.alert_events for select to authenticated using (public.is_staff());

-- Aggregates for the command centre and pattern explorer (staff only, invoker rights so RLS applies).
create view public.soc_daily_volume with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day, coalesce(flag::text, 'grey') as flag, count(*)::int as n
  from public.reports where created_at > now() - interval '30 days'
  group by 1, 2;

-- Trigram helpers (SPEC 6.4 step 2, A3 "similar items", A10 search). security invoker: RLS applies.
create function public.similar_messages(p_message uuid, p_limit int default 5)
returns table (id uuid, body_masked text, similarity real, campaign_id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public, extensions as $$
  select m.id, m.body_masked, similarity(m.body_masked, s.body_masked) as sim, m.campaign_id, m.created_at
  from public.messages m, public.messages s
  where s.id = p_message and m.id <> s.id and m.body_masked % s.body_masked
  order by sim desc limit p_limit
$$;

create function public.similar_campaign_by_body(p_body text, p_min real default 0.8, p_days int default 30)
returns table (campaign_id uuid, similarity real)
language sql stable security invoker set search_path = public, extensions as $$
  select m.campaign_id, similarity(m.body_masked, p_body) as sim
  from public.messages m
  where m.campaign_id is not null and m.created_at > now() - make_interval(days => p_days)
    and similarity(m.body_masked, p_body) >= p_min
  order by sim desc limit 1
$$;

create function public.search_messages(p_q text, p_limit int default 20)
returns table (id uuid, body_masked text, similarity real, campaign_id uuid, label public.msg_label)
language sql stable security invoker set search_path = public, extensions as $$
  select m.id, m.body_masked, similarity(m.body_masked, p_q) as sim, m.campaign_id, m.label
  from public.messages m
  where m.body_masked ilike '%' || p_q || '%' or m.body_masked % p_q
  order by sim desc limit p_limit
$$;

grant execute on function public.similar_messages(uuid, int), public.similar_campaign_by_body(text, real, int), public.search_messages(text, int)
  to authenticated, service_role;
