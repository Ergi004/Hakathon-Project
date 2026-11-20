-- Live threat-intelligence scans (VirusTotal, URLhaus, Hybrid Analysis, RDAP, crt.sh, DNS).
-- Writes happen only with the secret key; anonymous users see results through the
-- token-protected SSE route, never through these tables.

create type public.intel_provider as enum ('virustotal','urlhaus','hybrid_analysis','rdap','crtsh','dns','internal');
create type public.intel_status as enum ('pending','done','error','skipped','unavailable');
create type public.intel_verdict as enum ('malicious','suspicious','clean','unknown');
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  parent_scan_id uuid references public.scans(id) on delete cascade,   -- tier B scan of a tier A scan
  report_id uuid references public.reports(id) on delete set null,
  check_id uuid references public.checks(id) on delete set null,
  url_sanitized text not null,                 -- defanged scheme://host/path
  host text not null,
  registrable_domain text not null,
  tier text not null default 'A' check (tier in ('A','B')),
  status text not null default 'running' check (status in ('running','done','error','cancelled')),
  verdict public.intel_verdict not null default 'unknown',
  score_delta int not null default 0,
  base_score int,
  final_score int,
  domain_age_days int,
  registered_at date,
  mock boolean not null default false,
  requested_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on public.scans (report_id);
create index on public.scans (check_id);
create index on public.scans (parent_scan_id);
create index on public.scans (registrable_domain, created_at desc);
create table public.scan_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  provider public.intel_provider not null,
  status public.intel_status not null default 'pending',
  verdict public.intel_verdict not null default 'unknown',
  malicious_count int,
  total_count int,
  summary jsonb not null default '{}',         -- normalised fields only
  report_url text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (scan_id, provider)
);
create table public.intel_subdomains (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  registrable_domain text not null,
  subdomain text not null,
  source text not null check (source in ('virustotal','crtsh')),
  resolves boolean,
  first_cert_at date,
  verdict public.intel_verdict not null default 'unknown',
  brand_token boolean not null default false,
  unique (scan_id, subdomain)
);
create table public.intel_cache (
  key text primary key,
  provider public.intel_provider not null,
  payload jsonb not null,
  expires_at timestamptz not null
);
create index on public.intel_cache (expires_at);
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;
alter table public.intel_subdomains enable row level security;
alter table public.intel_cache enable row level security;
create policy scans_staff on public.scans for select to authenticated using (public.is_staff());
create policy scans_org on public.scans for select to authenticated using (
  report_id in (select id from public.reports where reporter_org_id is not null and public.is_org_member(reporter_org_id)));
-- Business lookalike-domains table shows age and verdict for domains imitating the member's institution.
create policy scans_brand on public.scans for select to authenticated using (
  exists (select 1 from public.domains d where d.domain = scans.registrable_domain and d.imitates_institution_id in (select public.my_institution_ids())));
create policy scan_results_staff on public.scan_results for select to authenticated using (public.is_staff());
create policy intel_sub_staff on public.intel_subdomains for select to authenticated using (public.is_staff());
-- intel_cache and all writes: secret key only (no policies for authenticated)

alter publication supabase_realtime add table public.scans, public.scan_results;
