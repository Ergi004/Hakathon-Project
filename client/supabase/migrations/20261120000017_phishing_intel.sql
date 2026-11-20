-- Phishing Intelligence Scanner (docs/PHISHING-INTEL.md): additive module.
-- Scans are owned by a user, an organisation (API key) or an extension install.
-- All writes go through the server with the secret key; clients only read what they own.

create table public.phishing_scans (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,                                   -- 'user:<uuid>' | 'org:<uuid>' | 'install:<uuid>'
  owner_user_id uuid references auth.users(id) on delete cascade,
  owner_org_id uuid references public.organizations(id) on delete cascade,
  owner_install_id uuid references public.extension_installs(id) on delete set null,
  idempotency_key text not null,
  channel text not null check (channel in ('email','sms','ott_message')),
  source text not null check (source in ('gmail','outlook','webmail','eml','msg','manual_input','sms_export','messages_web','api')),
  status text not null default 'queued' check (status in ('queued','processing','completed','partial','failed')),
  verdict text not null default 'unknown' check (verdict in ('malicious','suspicious','clean','unknown')),
  risk_score smallint check (risk_score between 0 and 100),
  severity text check (severity in ('low','medium','high','critical')),
  confidence real check (confidence between 0 and 1),
  phishing_type text,
  phishing_family text,
  malware_family text,
  campaign_id uuid references public.campaigns(id) on delete set null,
  threat_actor_id uuid,
  attribution_status text not null default 'unattributed' check (attribution_status in ('confirmed','high_confidence','possible','unattributed')),
  -- Minimised input kept for retries: masked text, URLs, sender, auth results, attachment metadata. Never raw bodies or files.
  input jsonb not null,
  options jsonb not null default '{}',
  stages jsonb not null default '{}',
  progress smallint not null default 0,
  attempts smallint not null default 0,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_key, idempotency_key),
  check (owner_user_id is not null or owner_org_id is not null or owner_install_id is not null)
);
create index on public.phishing_scans (owner_user_id, created_at desc);
create index on public.phishing_scans (owner_org_id, created_at desc);
create index on public.phishing_scans (owner_install_id, created_at desc);
create index on public.phishing_scans (status, updated_at);
create trigger phishing_scans_updated_at before update on public.phishing_scans for each row execute function public.set_updated_at();

create table public.scan_iocs (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.phishing_scans(id) on delete cascade,
  type text not null check (type in ('url','domain','ip','file_hash','email','phone_number','short_code')),
  value text not null,                                       -- defanged for display
  normalized_value text not null,
  location text not null,                                    -- body, html_href, header, sender, attachment, reply_to
  created_at timestamptz not null default now(),
  unique (scan_id, type, normalized_value)
);
create index on public.scan_iocs (type, normalized_value);

-- Shared provider cache (VirusTotal and later feeds). Not owned by any user.
create table public.ioc_reputation (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  ioc_type text not null,
  normalized_value text not null,
  found boolean not null,
  malicious int,
  suspicious int,
  harmless int,
  undetected int,
  reputation int,
  threat_label text,
  categories text[] not null default '{}',
  first_seen timestamptz,
  last_analysis_at timestamptz,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (provider, ioc_type, normalized_value)
);

create table public.phishing_classifications (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.phishing_scans(id) on delete cascade,
  dimension text not null check (dimension in ('phishing_type','phishing_family','malware_family')),
  value text not null,
  confidence real not null check (confidence between 0 and 1),
  evidence jsonb not null default '[]',
  source text not null default 'rules',                      -- rules, virustotal, ai
  created_at timestamptz not null default now()
);
create index on public.phishing_classifications (scan_id);

create table public.threat_actors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  description text,
  refs jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger threat_actors_updated_at before update on public.threat_actors for each row execute function public.set_updated_at();
alter table public.phishing_scans add constraint phishing_scans_actor_fkey foreign key (threat_actor_id) references public.threat_actors(id) on delete set null;

-- Explicit evidence linking an actor to a campaign or an indicator. Attribution is computed only from these rows.
create table public.actor_evidence (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.threat_actors(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  ioc_type text,
  ioc_value text,
  kind text not null check (kind in ('infrastructure','certificate','url_pattern','malware','ttp','report')),
  source text not null,
  source_url text,
  verified boolean not null default false,
  observed_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  check (campaign_id is not null or (ioc_type is not null and ioc_value is not null))
);
create index on public.actor_evidence (campaign_id);
create index on public.actor_evidence (ioc_type, ioc_value);

create table public.scan_techniques (
  scan_id uuid not null references public.phishing_scans(id) on delete cascade,
  technique_id text not null,
  name text not null,
  tactic text not null,
  observation text not null,
  primary key (scan_id, technique_id)
);

create table public.scan_reports (
  scan_id uuid primary key references public.phishing_scans(id) on delete cascade,
  channel text not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_analysis_logs (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.phishing_scans(id) on delete cascade,
  provider text not null check (provider in ('ollama','gemini')),
  model text not null,
  prompt_version text not null,
  policy text not null,
  status text not null check (status in ('ok','invalid','unavailable','refused')),
  latency_ms int,
  tokens int,
  created_at timestamptz not null default now()
);

create table public.scan_events (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.phishing_scans(id) on delete cascade,
  stage text not null,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);
create index on public.scan_events (scan_id, id);

-- ---- RLS -----------------------------------------------------------------------
alter table public.phishing_scans enable row level security;
alter table public.scan_iocs enable row level security;
alter table public.ioc_reputation enable row level security;
alter table public.phishing_classifications enable row level security;
alter table public.threat_actors enable row level security;
alter table public.actor_evidence enable row level security;
alter table public.scan_techniques enable row level security;
alter table public.scan_reports enable row level security;
alter table public.ai_analysis_logs enable row level security;
alter table public.scan_events enable row level security;

create function public.can_read_scan(p_scan uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.phishing_scans s
    where s.id = p_scan
      and (s.owner_user_id = (select auth.uid())
           or (s.owner_org_id is not null and public.is_org_member(s.owner_org_id))
           or exists (select 1 from public.extension_installs i where i.id = s.owner_install_id and i.user_id = (select auth.uid()))
           or public.is_staff())
  )
$$;

create policy phishing_scans_read on public.phishing_scans for select to authenticated using (public.can_read_scan(id));
create policy scan_iocs_read on public.scan_iocs for select to authenticated using (public.can_read_scan(scan_id));
create policy phishing_classifications_read on public.phishing_classifications for select to authenticated using (public.can_read_scan(scan_id));
create policy scan_techniques_read on public.scan_techniques for select to authenticated using (public.can_read_scan(scan_id));
create policy scan_reports_read on public.scan_reports for select to authenticated using (public.can_read_scan(scan_id));
create policy scan_events_read on public.scan_events for select to authenticated using (public.can_read_scan(scan_id));
create policy ai_analysis_logs_staff on public.ai_analysis_logs for select to authenticated using (public.is_staff());
create policy ioc_reputation_staff on public.ioc_reputation for select to authenticated using (public.is_staff());

-- Reference intelligence: signed-in users read actors, staff read evidence, leads curate both.
create policy threat_actors_read on public.threat_actors for select to authenticated using (true);
create policy threat_actors_lead on public.threat_actors for all to authenticated using (public.is_lead()) with check (public.is_lead());
create policy actor_evidence_staff_read on public.actor_evidence for select to authenticated using (public.is_staff());
create policy actor_evidence_lead on public.actor_evidence for all to authenticated using (public.is_lead()) with check (public.is_lead());
