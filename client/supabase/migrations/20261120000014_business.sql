-- SPEC 4 access matrix: "Campaigns that imitate my organization: Business Read (my brand only),
-- Institution contact Read (my institution only)"; takedown notices "Read ... for my org".
-- SPEC 9 B1, B4, B5, B6 need these rows; nothing here grants write access.

create function public.my_institution_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select i.id from public.institutions i
  join public.organization_members m on m.org_id = i.organization_id
  where m.user_id = (select auth.uid())
$$;
grant execute on function public.my_institution_ids() to authenticated;

create policy campaigns_org_read on public.campaigns for select to authenticated
  using (institution_id in (select public.my_institution_ids()));
create policy campaign_domains_org_read on public.campaign_domains for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_domains.campaign_id and c.institution_id in (select public.my_institution_ids())));
create policy domains_org_read on public.domains for select to authenticated
  using (imitates_institution_id in (select public.my_institution_ids()));
create policy certificates_org_read on public.certificates for select to authenticated
  using (exists (select 1 from public.domains d where d.id = certificates.domain_id and d.imitates_institution_id in (select public.my_institution_ids())));
create policy notices_org_read on public.takedown_notices for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = takedown_notices.campaign_id and c.institution_id in (select public.my_institution_ids())));
-- Reports about our brand: masked content and counts only (reporter columns are never selected by business pages).
create policy reports_brand_read on public.reports for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = reports.campaign_id and c.institution_id in (select public.my_institution_ids())));
create policy messages_org_read on public.messages for select to authenticated
  using (institution_id in (select public.my_institution_ids())
    or exists (select 1 from public.campaigns c where c.id = messages.campaign_id and c.institution_id in (select public.my_institution_ids())));

-- B12 organization settings
alter table public.organizations
  add column notification_emails text[] not null default '{}',
  add column retention_days int not null default 365 check (retention_days between 30 and 1825);
