-- Landing-page analysis through urlscan.io (docs/PHISHING-INTEL.md, landing-page sandbox).
-- The platform never opens a user-submitted URL itself (hard rule 6): it hands a sanitised URL
-- to urlscan.io, which renders it in its own sandbox, and stores what came back. Started by an
-- analyst only; observation only (no credentials are ever submitted).

create table public.landing_analyses (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.phishing_scans(id) on delete cascade,
  provider text not null default 'urlscan' check (provider in ('urlscan')),
  url text not null,                         -- sanitised URL actually submitted (victim e-mails replaced)
  url_key text not null,                     -- normalised for de-duplication across scans
  status text not null default 'queued' check (status in ('queued','submitted','completed','failed')),
  provider_uuid text,
  visibility text,
  result_url text,
  screenshot_url text,
  final_url text,
  final_domain text,
  page jsonb not null default '{}',          -- title, ip, asn, country, server, tls, status
  verdict jsonb not null default '{}',       -- urlscan overall verdict (score, malicious, brands, tags)
  forms jsonb not null default '[]',         -- [{ action, method, password, inputs }]
  exfil jsonb not null default '[]',         -- redacted exfiltration endpoints (no secrets)
  requests jsonb not null default '{}',      -- domains contacted, POST requests, redirects
  reputation jsonb not null default '[]',    -- VirusTotal for the final domain and data destinations
  sanitized jsonb not null default '[]',     -- what was replaced before submission (kinds, not values)
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.landing_analyses (scan_id, created_at desc);
create index on public.landing_analyses (url_key, created_at desc);
create index on public.landing_analyses (status, updated_at);
create trigger landing_analyses_updated_at before update on public.landing_analyses for each row execute function public.set_updated_at();

alter table public.landing_analyses enable row level security;
-- SOC only: it reveals attacker infrastructure and a third-party sandbox link.
create policy landing_analyses_staff_read on public.landing_analyses for select to authenticated using (public.is_staff());

-- Live progress on /soc/intel/[id].
alter publication supabase_realtime add table public.landing_analyses;
