-- Business sign-up without the secret key (SPEC 4: "sign-up creates an organization and
-- makes the user owner"). Called by the signed-in user right after sign-up.
-- At most one organization through this path: returns the existing one if any.
create function public.create_business_org(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'invalid name' using errcode = '22023'; end if;
  select org_id into v_org from public.organization_members where user_id = v_uid order by created_at limit 1;
  if v_org is not null then return v_org; end if;
  insert into public.organizations (type, name, slug)
  values ('business', v_name, coalesce(nullif(trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'org') || '-' || substr(md5(random()::text), 1, 6))
  returning id into v_org;
  insert into public.organization_members (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into public.audit_log (actor_id, action, entity, entity_id, data) values (v_uid, 'org.create', 'organization', v_org::text, '{"via":"signup"}');
  return v_org;
end $$;
revoke execute on function public.create_business_org(text) from public, anon;
grant execute on function public.create_business_org(text) to authenticated;
