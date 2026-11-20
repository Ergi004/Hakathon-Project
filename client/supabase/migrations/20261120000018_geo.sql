-- Geographic Threat Map (/soc/geo).
-- Location is coarse and optional: a municipality the citizen chose (or 'synthetic' demo data).
-- No coordinates are ever stored for reports. PostGIS is not needed: centroids and neighbours are
-- derived once by scripts/build-geo.ts from the official boundaries and loaded as plain rows.

create type public.region_level as enum ('county','municipality');
create type public.region_source as enum ('user_selected','institution_inferred','synthetic');

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- OCHA COD-AB P-code (AL01, AL0705…)
  name_sq text not null,
  name_en text,
  level public.region_level not null,
  parent_id uuid references public.regions(id),    -- municipality -> county
  population int check (population is null or population > 0),
  population_year int,
  centroid_lat double precision,
  centroid_lng double precision,
  hex_q int,
  hex_r int
);
create index on public.regions (level, parent_id);

create table public.region_neighbors (
  region_id uuid not null references public.regions(id) on delete cascade,
  neighbor_id uuid not null references public.regions(id) on delete cascade,
  primary key (region_id, neighbor_id),
  check (region_id <> neighbor_id)
);

alter table public.reports
  add column region_id uuid references public.regions(id),
  add column region_source public.region_source;
alter table public.institutions add column region_id uuid references public.regions(id);
alter table public.campaigns add column target_region_id uuid references public.regions(id);
create index on public.reports (region_id, created_at desc);

-- Pre-aggregated daily counts (no personal data). region_id null = "unknown location"
-- (victim mode) or "national / non-local authority" (imitated mode). campaign_id and confirmed
-- are extra dimensions so the campaign filter and the "confirmed only" toggle work on aggregates.
create table public.region_daily_stats (
  id bigint generated always as identity primary key,
  region_id uuid references public.regions(id) on delete cascade,
  day date not null,
  mode text not null check (mode in ('victim','imitated')),
  institution_id uuid references public.institutions(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  tactic text,
  channel public.msg_channel,
  flag public.flag_level,
  source public.report_source,
  confirmed boolean not null default false,
  report_count int not null check (report_count >= 0)
);
create unique index region_daily_stats_key on public.region_daily_stats
  (region_id, day, mode, institution_id, campaign_id, tactic, channel, flag, source, confirmed) nulls not distinct;
create index on public.region_daily_stats (mode, day);

create table public.geo_hotspots (
  id uuid primary key default gen_random_uuid(),
  computed_at timestamptz not null default now(),  -- identical for every row of one computation
  window_days int not null,
  mode text not null check (mode in ('victim','imitated')),
  region_id uuid not null references public.regions(id) on delete cascade,
  observed int not null,
  expected numeric not null,
  zscore numeric not null,
  smoothed_rate numeric,
  spike_ratio numeric,
  severity text not null check (severity in ('watch','elevated','critical')),
  zone_code text,                                  -- connected zone, named after its largest municipality
  top_campaign_id uuid references public.campaigns(id) on delete set null,
  top_institution_id uuid references public.institutions(id) on delete set null
);
create index on public.geo_hotspots (computed_at desc, severity);
create index on public.geo_hotspots (region_id, computed_at desc);

create table public.geo_alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_reports int not null default 5 check (min_reports >= 3),
  min_zscore numeric not null default 2.0,
  min_spike_ratio numeric not null default 3.0,
  institution_id uuid references public.institutions(id) on delete cascade,
  region_id uuid references public.regions(id) on delete cascade,   -- optional: rule for one area
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Analyst notes on a region (report_events-style, but attached to an area).
create table public.region_notes (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.region_notes (region_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Keep region_daily_stats fresh: incremental trigger + full rebuild.
-- ---------------------------------------------------------------------------
create function public.region_stats_bump(
  p_region uuid, p_day date, p_mode text, p_inst uuid, p_campaign uuid, p_tactic text,
  p_channel public.msg_channel, p_flag public.flag_level, p_source public.report_source, p_confirmed boolean, p_delta int
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.region_daily_stats (region_id, day, mode, institution_id, campaign_id, tactic, channel, flag, source, confirmed, report_count)
  values (p_region, p_day, p_mode, p_inst, p_campaign, p_tactic, p_channel, p_flag, p_source, p_confirmed, greatest(p_delta, 0))
  on conflict (region_id, day, mode, institution_id, campaign_id, tactic, channel, flag, source, confirmed)
  do update set report_count = greatest(public.region_daily_stats.report_count + p_delta, 0);
  if p_delta < 0 then
    delete from public.region_daily_stats s
     where s.report_count = 0 and s.region_id is not distinct from p_region and s.day = p_day and s.mode = p_mode
       and s.institution_id is not distinct from p_inst and s.campaign_id is not distinct from p_campaign
       and s.tactic is not distinct from p_tactic and s.channel is not distinct from p_channel
       and s.flag is not distinct from p_flag and s.source is not distinct from p_source and s.confirmed = p_confirmed;
  end if;
end $$;

create function public.region_stats_apply(p public.reports, p_delta int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (p.created_at at time zone 'Europe/Tirane')::date;
  v_inst uuid; v_tactic text; v_target uuid;
  v_confirmed boolean := p.status in ('confirmed','takedown_requested','taken_down');
begin
  -- Reports judged "not a scam" or duplicates are not threats on the map.
  if p.status in ('not_scam','duplicate') then return; end if;
  if p.campaign_id is not null then
    select c.institution_id, c.tactic, coalesce(c.target_region_id, i.region_id)
      into v_inst, v_tactic, v_target
      from public.campaigns c left join public.institutions i on i.id = c.institution_id
     where c.id = p.campaign_id;
  end if;
  if p.message_id is not null and (v_inst is null or v_tactic is null) then
    select coalesce(v_inst, m.institution_id), coalesce(v_tactic, m.tactic) into v_inst, v_tactic
      from public.messages m where m.id = p.message_id;
  end if;
  if v_target is null and v_inst is not null then
    select region_id into v_target from public.institutions where id = v_inst;
  end if;
  perform public.region_stats_bump(p.region_id, v_day, 'victim', v_inst, p.campaign_id, v_tactic, p.channel, p.flag, p.source, v_confirmed, p_delta);
  perform public.region_stats_bump(v_target, v_day, 'imitated', v_inst, p.campaign_id, v_tactic, p.channel, p.flag, p.source, v_confirmed, p_delta);
end $$;

create function public.reports_region_stats() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform public.region_stats_apply(old, -1); end if;
  if tg_op in ('INSERT','UPDATE') then perform public.region_stats_apply(new, 1); end if;
  return null;
end $$;

create trigger reports_region_stats
  after insert or delete or update of region_id, status, campaign_id, message_id, flag, channel, source
  on public.reports for each row execute function public.reports_region_stats();

-- Full rebuild (nightly cron, and after campaign/institution regions change).
create function public.rebuild_region_stats() returns int
language plpgsql security definer set search_path = '' as $$
declare r public.reports; n int := 0;
begin
  delete from public.region_daily_stats where true;
  for r in select * from public.reports loop
    perform public.region_stats_apply(r, 1);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.region_stats_bump(uuid, date, text, uuid, uuid, text, public.msg_channel, public.flag_level, public.report_source, boolean, int) from public, anon, authenticated;
revoke all on function public.region_stats_apply(public.reports, int) from public, anon, authenticated;
revoke all on function public.reports_region_stats() from public, anon, authenticated;
revoke all on function public.rebuild_region_stats() from public, anon, authenticated;
grant execute on function public.rebuild_region_stats() to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.regions enable row level security;
alter table public.region_neighbors enable row level security;
alter table public.region_daily_stats enable row level security;
alter table public.geo_hotspots enable row level security;
alter table public.geo_alert_rules enable row level security;
alter table public.region_notes enable row level security;

create policy regions_read on public.regions for select to authenticated using (true);
create policy region_neighbors_read on public.region_neighbors for select to authenticated using (true);
-- Aggregates and hot spots: staff only. Writes only through the secret key (no write policies).
create policy region_daily_stats_staff on public.region_daily_stats for select to authenticated using (public.is_staff());
create policy geo_hotspots_staff on public.geo_hotspots for select to authenticated using (public.is_staff());
-- Alert rules: staff read, leads write.
create policy geo_alert_rules_staff_read on public.geo_alert_rules for select to authenticated using (public.is_staff());
create policy geo_alert_rules_lead_write on public.geo_alert_rules for insert to authenticated with check (public.is_lead());
create policy geo_alert_rules_lead_update on public.geo_alert_rules for update to authenticated using (public.is_lead()) with check (public.is_lead());
create policy geo_alert_rules_lead_delete on public.geo_alert_rules for delete to authenticated using (public.is_lead());
-- Region notes: staff read; staff add their own.
create policy region_notes_staff_read on public.region_notes for select to authenticated using (public.is_staff());
create policy region_notes_staff_insert on public.region_notes for insert to authenticated with check (public.is_staff() and author_id = (select auth.uid()));

alter publication supabase_realtime add table public.geo_hotspots;

-- Default severity thresholds (editable by leads in /soc/admin) and a default alert rule.
insert into public.settings (key, value) values ('geo_thresholds', '{
  "watch":    { "minObserved": 3,  "minZ": 1.5 },
  "elevated": { "minObserved": 5,  "minZ": 2 },
  "critical": { "minObserved": 10, "minZ": 3, "minSpike": 3 },
  "windowDays": 7, "baselineDays": 28
}'::jsonb) on conflict (key) do nothing;
insert into public.geo_alert_rules (name, min_reports, min_zscore, min_spike_ratio) values ('Default: elevated or critical area', 5, 2.0, 1.0);
