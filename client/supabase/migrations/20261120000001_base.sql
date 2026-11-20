create extension if not exists pg_trgm with schema extensions;

create type public.app_platform_role as enum ('user','soc_analyst','soc_lead','platform_admin');
create type public.org_type as enum ('business','institution','soc');
create type public.org_member_role as enum ('owner','admin','security','comms','finance','viewer','contact');
create type public.msg_channel as enum ('sms','email','social','web','qr','call','other');
create type public.msg_label as enum ('phishing','legitimate','unknown');
create type public.flag_level as enum ('green','yellow','orange','red','darkred','grey');
create type public.report_source as enum ('citizen_check','citizen_report','extension','feed','business','import');
create type public.report_status as enum ('received','under_review','confirmed','not_scam','takedown_requested','taken_down','duplicate');
create type public.campaign_status as enum ('monitoring','confirmed','takedown_in_progress','resolved');
create type public.domain_class as enum ('typosquat','homoglyph','combosquat','legitimate','unknown');
create type public.ioc_type as enum ('domain','url','ip','cert','phone','email','file_hash');
create type public.notice_type as enum ('registrar','hosting','akcesk');
create type public.notice_status as enum ('draft','in_review','approved','sent','acknowledged','taken_down','no_response','rejected');
create type public.severity as enum ('low','medium','high','critical');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'sq' check (locale in ('sq','en')),
  platform_role public.app_platform_role not null default 'user',
  safety_score int not null default 0 check (safety_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null,
  slug text not null unique,
  country text not null default 'AL',
  plan text not null default 'free' check (plan in ('free','pro','enterprise')),
  created_at timestamptz not null default now()
);
create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Access helpers used by every policy. security definer + empty search_path.
create function public.platform_role() returns public.app_platform_role
language sql stable security definer set search_path = '' as $$
  select platform_role from public.profiles where id = (select auth.uid())
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() in ('soc_analyst','soc_lead','platform_admin'), false)
$$;
create function public.is_lead() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() in ('soc_lead','platform_admin'), false)
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() = 'platform_admin', false)
$$;
create function public.org_role(p_org uuid) returns public.org_member_role
language sql stable security definer set search_path = '' as $$
  select role from public.organization_members where org_id = p_org and user_id = (select auth.uid())
$$;
create function public.is_org_member(p_org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members where org_id = p_org and user_id = (select auth.uid()))
$$;
