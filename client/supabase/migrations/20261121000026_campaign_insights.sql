-- Campaign panel insights (SOC A4/A5): per-campaign report breakdown and a whole-panel overview.
-- security invoker throughout: callers see only what their RLS already allows (staff).

-- Report counts per campaign by status, flag and channel. Filtered with `.eq('campaign_id', id)`.
create view public.campaign_report_counts with (security_invoker = true) as
  select campaign_id, status, coalesce(flag::text, 'grey') as flag, channel, count(*)::int as n
  from public.reports
  where campaign_id is not null
  group by campaign_id, status, coalesce(flag::text, 'grey'), channel;

create index if not exists reports_campaign_created_idx on public.reports (campaign_id, created_at desc) where campaign_id is not null;

-- Overview for the campaigns list: weekly activity, the most active campaigns of the last
-- 30 days, the severity × status matrix and tactics. One round trip for the whole band.
create or replace function public.soc_campaign_overview(p_weeks int default 12)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - make_interval(weeks => greatest(p_weeks, 1) - 1),
      date_trunc('week', now()),
      interval '1 week'
    )::date as week
  ),
  rep as (
    select date_trunc('week', created_at)::date as week, count(*)::int as n
    from public.reports
    where campaign_id is not null and created_at >= (select min(week) from weeks)
    group by 1
  ),
  born as (
    select date_trunc('week', coalesce(first_seen::timestamptz, created_at))::date as week, count(*)::int as n
    from public.campaigns
    where coalesce(first_seen::timestamptz, created_at) >= (select min(week) from weeks)
    group by 1
  ),
  recent as (
    select campaign_id, count(*)::int as n
    from public.reports
    where campaign_id is not null and created_at >= now() - interval '30 days'
    group by 1
  )
  select jsonb_build_object(
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('week', w.week, 'reports', coalesce(r.n, 0), 'campaigns', coalesce(b.n, 0)) order by w.week)
      from weeks w left join rep r using (week) left join born b using (week)), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(x order by x.n desc, x.code) from (
      select c.id, c.code, coalesce(i.name, c.imitated_name) as name, c.severity, c.status, r.n
      from recent r join public.campaigns c on c.id = r.campaign_id
      left join public.institutions i on i.id = c.institution_id
      order by r.n desc, c.code limit 8) x), '[]'::jsonb),
    'matrix', coalesce((select jsonb_agg(x) from (
      select severity, status, count(*)::int as n from public.campaigns group by 1, 2) x), '[]'::jsonb),
    'tactics', coalesce((select jsonb_agg(x order by x.campaigns desc, x.name) from (
      select tactic as name, count(*)::int as campaigns, coalesce(sum(message_count), 0)::int as messages
      from public.campaigns group by 1) x), '[]'::jsonb)
  )
$$;

grant execute on function public.soc_campaign_overview(int) to authenticated;
