create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sector text not null default 'other' check (sector in ('government','municipality','bank','postal','utility','telecom','police','other')),
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.official_domains (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  domain text not null unique check (domain = lower(domain)),
  verified boolean not null default true
);
create table public.official_channels (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  kind text not null check (kind in ('sms_sender','phone','social','email')),
  value text not null,
  unique (kind, value)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- F019 for dataset campaigns, C-2026-0001 for detected
  tactic text not null,
  institution_id uuid references public.institutions(id),
  imitated_name text,
  first_seen date,
  last_seen date,
  message_count int not null default 0,
  status public.campaign_status not null default 'monitoring',
  severity public.severity not null default 'medium',
  owner_id uuid references public.profiles(id),
  summary text,
  is_public boolean not null default false,
  source text not null default 'dataset' check (source in ('dataset','detected','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create index on public.campaigns (institution_id, status);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain = lower(domain)),
  class public.domain_class not null default 'unknown',
  imitates_domain text,
  imitates_institution_id uuid references public.institutions(id),
  rule text,
  registered_at date,
  age_days int,
  registrar text,
  nameserver text,
  hosting_country text,
  privacy boolean,
  in_ct_log boolean not null default false,
  risk_score int check (risk_score between 0 and 100),
  status text not null default 'watching' check (status in ('watching','threat','dismissed','taken_down','allowlisted')),
  first_seen_at timestamptz not null default now()
);
create index on public.domains (class, status);
create index on public.domains (imitates_institution_id);
create table public.campaign_domains (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  primary key (campaign_id, domain_id)
);
create table public.certificates (
  cert_id text primary key,
  domain_id uuid references public.domains(id) on delete cascade,
  san text[] not null default '{}',
  issuer text,
  not_before date,
  not_after date,
  label public.domain_class,
  imitated_domain text,
  campaign_id uuid references public.campaigns(id) on delete set null
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,                   -- M00001 from the dataset
  channel public.msg_channel not null,
  language text not null check (language in ('sq','en')),
  sender_masked text,
  subject text,
  body_masked text not null,
  body_hash text not null,
  urls text[] not null default '{}',         -- stored defanged
  label public.msg_label not null default 'unknown',
  score int check (score between 0 and 100),
  flag public.flag_level,
  campaign_id uuid references public.campaigns(id) on delete set null,
  institution_id uuid references public.institutions(id),
  tactic text,
  template_id text,
  received_at timestamptz,
  source text not null default 'dataset',
  created_at timestamptz not null default now()
);
create index on public.messages (campaign_id);
create index on public.messages (body_hash);
create index on public.messages using gin (body_masked extensions.gin_trgm_ops);

create table public.iocs (
  id uuid primary key default gen_random_uuid(),
  type public.ioc_type not null,
  value text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  source text not null default 'system',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (type, value)
);

-- Hash lookup for the anonymous checker. No message text is kept for ordinary checks.
create table public.known_hashes (
  hash text primary key,
  kind text not null check (kind in ('url','domain','text','phone')),
  flag public.flag_level not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  seen_count int not null default 1,
  last_seen timestamptz not null default now()
);
