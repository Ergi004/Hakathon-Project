-- Enable RLS everywhere
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: self read/update (not role), staff read all, admin writes roles
create policy profiles_self_read on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and platform_role = (select platform_role from public.profiles where id = (select auth.uid())));
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- organizations and members
create policy org_member_read on public.organizations for select to authenticated using (public.is_org_member(id) or public.is_staff());
create policy org_admin_write on public.organizations for update to authenticated using (public.org_role(id) in ('owner','admin')) with check (public.org_role(id) in ('owner','admin'));
create policy members_read on public.organization_members for select to authenticated using (public.is_org_member(org_id) or public.is_staff());
create policy members_manage on public.organization_members for all to authenticated
  using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));

-- Reference data: any signed-in user reads, leads write
do $$ declare t text; begin
  foreach t in array array['institutions','official_domains','official_channels','recipients','templates','model_versions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_lead()) with check (public.is_lead())', t||'_lead', t);
  end loop;
end $$;

-- Staff-only investigation data: read for all staff, write for analysts and above
do $$ declare t text; begin
  foreach t in array array['campaigns','domains','campaign_domains','certificates','messages','iocs','known_hashes','checks','reports','report_events','campaign_notes','extension_installs','extension_reports','cases','feedback_labels','blocklist_entries','alert_rules'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t||'_staff_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t||'_staff_write', t);
  end loop;
end $$;

-- Citizens with an account see only reports they filed
create policy reports_owner_read on public.reports for select to authenticated using (reporter_id = (select auth.uid()));
-- Business members see reports filed by their org
create policy reports_org_read on public.reports for select to authenticated using (reporter_org_id is not null and public.is_org_member(reporter_org_id));
create policy reports_org_insert on public.reports for insert to authenticated with check (reporter_org_id is not null and public.org_role(reporter_org_id) in ('owner','admin','security'));

-- Takedown: staff read, analysts create drafts, only leads approve and send
create policy notices_staff_read on public.takedown_notices for select to authenticated using (public.is_staff());
create policy notices_analyst_insert on public.takedown_notices for insert to authenticated with check (public.is_staff() and status = 'draft' and created_by = (select auth.uid()));
create policy notices_analyst_update_draft on public.takedown_notices for update to authenticated using (public.is_staff() and status in ('draft','in_review') and created_by = (select auth.uid())) with check (status in ('draft','in_review'));
create policy notices_lead_all on public.takedown_notices for update to authenticated using (public.is_lead()) with check (public.is_lead());
create policy notice_events_staff on public.notice_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Advisories: public reads published via the public view; staff manage
create policy advisories_staff on public.advisories for all to authenticated using (public.is_staff()) with check (public.is_staff() and (status <> 'published' or public.is_lead()));

-- Settings: staff read, admin write
create policy settings_read on public.settings for select to authenticated using (public.is_staff());
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifications: owner only
create policy notifications_owner on public.notifications for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Business tables: org members by role
create policy brand_assets_read on public.brand_assets for select to authenticated using (public.is_org_member(org_id) or public.is_staff());
create policy brand_assets_write on public.brand_assets for all to authenticated using (public.org_role(org_id) in ('owner','admin','security')) with check (public.org_role(org_id) in ('owner','admin','security'));
create policy brand_alerts_read on public.brand_alerts for select to authenticated using (public.is_org_member(org_id) or public.is_staff());
create policy brand_alerts_update on public.brand_alerts for update to authenticated using (public.org_role(org_id) in ('owner','admin','security')) with check (public.org_role(org_id) in ('owner','admin','security'));
create policy simulations_org on public.simulations for all to authenticated using (public.org_role(org_id) in ('owner','admin','security','comms')) with check (public.org_role(org_id) in ('owner','admin','security','comms'));
create policy api_keys_org on public.api_keys for all to authenticated using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));

-- Audit: leads and admins read, nobody writes through the API (server uses the secret key)
create policy audit_read on public.audit_log for select to authenticated using (public.is_lead());

-- Public, sanitized threat feed (no reporter data, only confirmed or public campaigns)
create view public.public_threat_feed with (security_invoker = false) as
  select c.code, c.tactic, c.imitated_name, c.first_seen, c.last_seen, c.message_count, c.status,
         coalesce((select array_agg(d.domain) from public.campaign_domains cd join public.domains d on d.id = cd.domain_id where cd.campaign_id = c.id), '{}') as domains
  from public.campaigns c where c.is_public and c.status in ('confirmed','takedown_in_progress','resolved');
revoke all on public.public_threat_feed from anon, authenticated;
grant select on public.public_threat_feed to service_role;   -- exposed only through /api/v1/feed

-- Storage buckets (create in seed.sql): evidence (private), brand-assets (private), exports (private). No public buckets.
-- Realtime: alter publication supabase_realtime add table public.reports, public.notifications, public.takedown_notices, public.campaigns;
