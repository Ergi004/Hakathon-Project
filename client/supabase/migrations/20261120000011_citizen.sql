-- SPEC 8: migration 0005_citizen. Owner-only RLS on every table.

-- Preferences the citizen pages need (C2 "save my history", C4 alerts, C10 settings)
alter table public.profiles
  add column save_history boolean not null default false,
  add column notify_email boolean not null default true,
  add column notify_in_app boolean not null default true;

-- C2: checks are linked to a user only when "save my history" is on
create table public.user_check_links (
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_id uuid not null references public.checks(id) on delete cascade,
  kind text not null,                            -- url, text, phone, qr, email_signals (no input stored)
  created_at timestamptz not null default now(),
  primary key (user_id, check_id)
);
create index on public.user_check_links (user_id, created_at desc);

-- C4: institutions a citizen follows for alerts
create table public.user_follows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, institution_id)
);

-- C5: watch items stored hashed; matching on hash only
create table public.user_watch_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('phone','email','name')),
  value_hash text not null,
  label text not null,                           -- masked hint shown to the owner, e.g. +355 69 *** **67
  last_match_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, value_hash)
);

-- C6: learning progress and badges
create table public.user_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  guide_slug text not null,
  quiz_score int check (quiz_score between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, guide_slug)
);
create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge text not null check (badge in ('first_check','first_report','streak_7','quiz_master','extension_guard')),
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge)
);

-- C9: consent log
create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,                            -- save_history, extension_auto_submit, notify_email, terms
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index on public.consent_log (user_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['user_check_links','user_follows','user_watch_items','user_progress','user_badges','consent_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t||'_owner', t);
  end loop;
end $$;

-- Badges and consent are written by the server only (never self-awarded): owner may read, not write.
drop policy user_badges_owner on public.user_badges;
create policy user_badges_owner_read on public.user_badges for select to authenticated using (user_id = (select auth.uid()));
drop policy consent_log_owner on public.consent_log;
create policy consent_log_owner_read on public.consent_log for select to authenticated using (user_id = (select auth.uid()));

-- Citizens read their own checks through the link table (checks itself stays staff-only otherwise)
create policy checks_owner_read on public.checks for select to authenticated
  using (exists (select 1 from public.user_check_links l where l.check_id = checks.id and l.user_id = (select auth.uid())));

-- Citizens see their own extension installs and what was sent (C8)
create policy extension_installs_owner on public.extension_installs for select to authenticated using (user_id = (select auth.uid()));
create policy extension_installs_owner_update on public.extension_installs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy extension_reports_owner on public.extension_reports for select to authenticated
  using (exists (select 1 from public.extension_installs i where i.id = extension_reports.install_id and i.user_id = (select auth.uid())));

-- Report timelines for the reporter (C3) and the reporting org (B6)
create policy report_events_owner_read on public.report_events for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_events.report_id
    and (r.reporter_id = (select auth.uid()) or (r.reporter_org_id is not null and public.is_org_member(r.reporter_org_id)))));
