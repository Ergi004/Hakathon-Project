-- SPEC 12.3: install tokens are random and stored hashed server-side.
alter table public.extension_installs add column token_hash text unique;

-- SPEC 9 B9: API key usage chart (per key per day). Written by the server only.
create table public.api_usage (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (key_id, day)
);
alter table public.api_usage enable row level security;
create policy api_usage_org_read on public.api_usage for select to authenticated
  using (exists (select 1 from public.api_keys k where k.id = api_usage.key_id and public.org_role(k.org_id) in ('owner','admin')));

create function public.api_usage_hit(p_key uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.api_usage as u (key_id, day, calls) values (p_key, current_date, 1)
  on conflict (key_id, day) do update set calls = u.calls + 1;
  update public.api_keys set last_used_at = now() where id = p_key;
$$;
revoke execute on function public.api_usage_hit(uuid) from public, anon, authenticated;
grant execute on function public.api_usage_hit(uuid) to service_role;
