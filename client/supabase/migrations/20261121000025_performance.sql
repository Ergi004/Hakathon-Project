-- Performance: indexes for the paginated list queries, and server-side aggregates
-- that replace pulling thousands of rows into the Worker to count them in JS.

-- ---------------------------------------------------------------- indexes
-- Each one matches an existing `.eq(...).order(...)` or `.order(...).range(...)` query.

-- Campaign pattern panels filter checks by campaign (was a sequential scan of checks).
create index if not exists checks_campaign_classified_idx
  on public.checks (campaign_id, created_at desc) where scam_type is not null;

-- SOC inbox and activity feeds order by created_at with optional filters.
create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_reporter_created_idx on public.reports (reporter_id, created_at desc);
create index if not exists reports_assigned_to_idx on public.reports (assigned_to) where assigned_to is not null;
create index if not exists report_events_created_at_idx on public.report_events (created_at desc);

create index if not exists campaigns_last_seen_idx on public.campaigns (last_seen desc nulls last);
create index if not exists campaigns_status_last_seen_idx on public.campaigns (status, last_seen desc nulls last);
create index if not exists campaign_notes_campaign_idx on public.campaign_notes (campaign_id, created_at desc);

create index if not exists takedown_notices_created_at_idx on public.takedown_notices (created_at desc);
create index if not exists takedown_notices_status_created_idx on public.takedown_notices (status, created_at desc);
create index if not exists takedown_notices_campaign_idx on public.takedown_notices (campaign_id);
create index if not exists notice_events_notice_idx on public.notice_events (notice_id, created_at);

create index if not exists blocklist_entries_created_at_idx on public.blocklist_entries (created_at desc);
create index if not exists advisories_published_at_idx on public.advisories (published_at desc nulls first);
create index if not exists advisories_campaign_idx on public.advisories (campaign_id);
create index if not exists feedback_labels_created_at_idx on public.feedback_labels (created_at desc);
create index if not exists user_watch_items_user_created_idx on public.user_watch_items (user_id, created_at desc);
create index if not exists iocs_campaign_idx on public.iocs (campaign_id);
create index if not exists extension_reports_report_idx on public.extension_reports (report_id);

-- `ilike '%term%'` searches on domains and IoCs (SOC domains filter, global search).
create index if not exists domains_domain_trgm_idx on public.domains using gin (domain extensions.gin_trgm_ops);
create index if not exists iocs_value_trgm_idx on public.iocs using gin (value extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- aggregates
-- security invoker: the caller's RLS applies, exactly as with the table queries they replace.

-- SOC threat map (A9). Replaces ~20k rows fetched and counted in JS on every view.
create or replace function public.soc_pattern_stats(p_days int default 90)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with r as (
    select r.created_at, r.channel::text as channel, i.name as institution
    from public.reports r
    left join public.messages m on m.id = r.message_id
    left join public.institutions i on i.id = m.institution_id
    where r.created_at >= now() - make_interval(days => p_days)
  ),
  d as (select registrar, hosting_country from public.domains where status <> 'allowlisted')
  select jsonb_build_object(
    'byInstitution', coalesce((select jsonb_agg(x) from (
      select institution as name, count(*)::int as value from r where coalesce(institution, '') <> ''
      group by 1 order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    'channels', coalesce((select jsonb_agg(x) from (
      select channel as name, count(*)::int as value from r where coalesce(channel, '') <> ''
      group by 1 order by 2 desc, 1) x), '[]'::jsonb),
    'tactics', coalesce((select jsonb_agg(x) from (
      select tactic::text as name, sum(coalesce(nullif(message_count, 0), 1))::int as value
      from public.campaigns where coalesce(tactic::text, '') <> ''
      group by 1 order by 2 desc, 1 limit 8) x), '[]'::jsonb),
    'registrars', coalesce((select jsonb_agg(x) from (
      select registrar as name, count(*)::int as value from d where coalesce(registrar, '') <> ''
      group by 1 order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    'hosting', coalesce((select jsonb_agg(x) from (
      select hosting_country as name, count(*)::int as value from d where coalesce(hosting_country, '') <> ''
      group by 1 order by 2 desc, 1 limit 10) x), '[]'::jsonb),
    -- Monday = 0, hours in UTC (what the Worker's JS Date used).
    'heat', coalesce((select jsonb_agg(x) from (
      select (extract(isodow from created_at at time zone 'UTC')::int - 1) as d,
             extract(hour from created_at at time zone 'UTC')::int as h,
             count(*)::int as n
      from r group by 1, 2) x), '[]'::jsonb)
  )
$$;

-- SOC command centre "needs attention": institutions with a spike of reports since a time.
-- Replaces fetching up to 2000 joined report rows to count them in JS.
create or replace function public.soc_institution_spikes(p_since timestamptz, p_min int default 20)
returns table (name text, count int)
language sql stable security invoker set search_path = public as $$
  select i.name, count(*)::int
  from public.reports r
  join public.messages m on m.id = r.message_id
  join public.institutions i on i.id = m.institution_id
  where r.created_at >= p_since
  group by i.name
  having count(*) >= p_min
  order by 2 desc
$$;

grant execute on function public.soc_pattern_stats(int) to authenticated;
grant execute on function public.soc_institution_spikes(timestamptz, int) to authenticated;

-- ---------------------------------------------------------------- stat-card counts
-- One request per stats row instead of one count request per card. A Worker keeps only
-- six outbound connections open at once, so fewer parallel requests means less queueing.
-- security_invoker: each view returns only the rows the caller can already read.

create view public.campaign_status_counts with (security_invoker = true) as
  select status, count(*)::int as n from public.campaigns group by status;

create view public.takedown_status_counts with (security_invoker = true) as
  select status, count(*)::int as n,
         count(*) filter (where due_at < now())::int as overdue
  from public.takedown_notices group by status;

create view public.advisory_status_counts with (security_invoker = true) as
  select status, count(*)::int as n from public.advisories group by status;

-- Filtered by the caller with `.eq('reporter_id', uid)`; RLS limits citizens to their own rows.
create view public.report_status_counts_by_reporter with (security_invoker = true) as
  select reporter_id, status, count(*)::int as n from public.reports
  where reporter_id is not null group by reporter_id, status;

-- Same audience as public_threat_feed: server-side only.
create view public.public_threat_feed_counts with (security_invoker = false) as
  select status, count(*)::int as n from public.public_threat_feed group by status;
revoke all on public.public_threat_feed_counts from anon, authenticated;
grant select on public.public_threat_feed_counts to service_role;
