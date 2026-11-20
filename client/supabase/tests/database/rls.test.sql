-- RLS tests (SPEC 5 notes, 15.3). Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres, RLS bypassed)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'citizen@demo.example', '{"full_name":"Qytetar Demo"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'analyst@demo.example', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'lead@demo.example', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'lead2@demo.example', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@demo.example', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner@demo-bank.example', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'owner@other-org.example', '{}', 'authenticated', 'authenticated');

update public.profiles set platform_role = 'soc_analyst' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set platform_role = 'soc_lead' where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');
update public.profiles set platform_role = 'platform_admin' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.organizations (id, type, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'business', 'Banka Demo', 'banka-demo'),
  ('00000000-0000-0000-0000-00000000000b', 'business', 'Org Tjeter', 'org-tjeter');
insert into public.organization_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2', 'owner');

insert into public.campaigns (id, code, tactic, is_public, status) values
  ('00000000-0000-0000-0000-0000000000f1', 'F019', 'parking_fine', true, 'confirmed');

insert into public.reports (id, source, reporter_id, reporter_org_id) values
  ('00000000-0000-0000-0000-000000000e01', 'citizen_report', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-000000000e02', 'business', null, '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-000000000e03', 'business', null, '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-000000000e04', 'citizen_check', null, null);

insert into public.brand_assets (org_id, kind, value) values
  ('00000000-0000-0000-0000-00000000000a', 'domain', 'banka-demo.example'),
  ('00000000-0000-0000-0000-00000000000b', 'domain', 'org-tjeter.example');

insert into public.takedown_notices (id, campaign_id, kind, status, subject, body, created_by) values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-0000000000f1', 'registrar', 'in_review', 's', 'b',
   '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-0000000000f1', 'hosting', 'in_review', 's', 'b',
   '00000000-0000-0000-0000-0000000000d1');

insert into public.settings (key, value) values ('rls_test', '{}') on conflict do nothing;
insert into public.audit_log (action, entity) values ('test.fixture', 'test');

-- ---------------------------------------------------------------------------
-- Citizen
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.profiles), 1, 'citizen sees only own profile');
select throws_ok(
  $$ update public.profiles set platform_role = 'soc_lead' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  '42501', null, 'citizen cannot raise own platform_role');
select lives_ok(
  $$ update public.profiles set full_name = 'Emer i ri' where id = '00000000-0000-0000-0000-0000000000c1' $$,
  'citizen can update own name');
select results_eq($$ select id from public.reports $$,
  $$ values ('00000000-0000-0000-0000-000000000e01'::uuid) $$, 'citizen sees only own reports');
select is((select count(*)::int from public.campaigns), 0, 'citizen cannot read campaigns');
select is((select count(*)::int from public.checks), 0, 'citizen cannot read checks');
select is((select count(*)::int from public.audit_log), 0, 'citizen cannot read audit log');
select throws_ok($$ select * from public.public_threat_feed $$, '42501', null,
  'public_threat_feed not readable by authenticated');
select throws_ok(
  $$ insert into public.reports (source, reporter_id) values ('citizen_report', '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'citizen cannot insert reports directly');

reset role;

-- ---------------------------------------------------------------------------
-- Business member (owner of Banka Demo)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

select results_eq($$ select id from public.reports $$,
  $$ values ('00000000-0000-0000-0000-000000000e02'::uuid) $$, 'business sees only own org reports');
select results_eq($$ select value from public.brand_assets $$,
  $$ values ('banka-demo.example') $$, 'business sees only own brand assets');
select throws_ok(
  $$ insert into public.brand_assets (org_id, kind, value) values ('00000000-0000-0000-0000-00000000000b', 'domain', 'x.example') $$,
  '42501', null, 'business cannot write another org brand assets');
select is((select count(*)::int from public.organizations), 1, 'business sees only own organization');
select is((select count(*)::int from public.messages), 0, 'business cannot read raw messages');
select lives_ok(
  $$ insert into public.reports (source, reporter_org_id) values ('business', '00000000-0000-0000-0000-00000000000a') $$,
  'business owner can escalate a report for own org');
select throws_ok(
  $$ insert into public.reports (source, reporter_org_id) values ('business', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'business cannot file a report for another org');

reset role;

-- ---------------------------------------------------------------------------
-- SOC analyst
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select cmp_ok((select count(*)::int from public.reports), '>=', 4, 'analyst sees all reports');
select lives_ok(
  $$ update public.reports set status = 'under_review' where id = '00000000-0000-0000-0000-000000000e01' $$,
  'analyst can triage a report');
select is((select count(*)::int from public.audit_log), 0, 'analyst cannot read audit log');
select throws_ok(
  $$ update public.takedown_notices set status = 'approved', approved_by = '00000000-0000-0000-0000-0000000000d1'
     where id = '00000000-0000-0000-0000-000000000701' $$,
  '42501', null, 'analyst cannot approve a notice');
select is_empty(
  $$ update public.settings set value = '{"x":1}' where key = 'rls_test' returning key $$,
  'analyst cannot change settings');
select is_empty(
  $$ update public.profiles set platform_role = 'soc_lead' where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'analyst cannot change roles');

reset role;

-- ---------------------------------------------------------------------------
-- SOC lead
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;

select cmp_ok((select count(*)::int from public.audit_log), '>=', 1, 'lead can read audit log');
select throws_ok(
  $$ update public.takedown_notices set status = 'approved', approved_by = '00000000-0000-0000-0000-0000000000d1'
     where id = '00000000-0000-0000-0000-000000000702' $$,
  '23514', null, 'four-eyes: lead cannot approve own notice');
select lives_ok(
  $$ update public.takedown_notices set status = 'approved', approved_by = '00000000-0000-0000-0000-0000000000d1'
     where id = '00000000-0000-0000-0000-000000000701' $$,
  'lead can approve a notice created by someone else');
select is_empty(
  $$ update public.profiles set platform_role = 'soc_lead' where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'lead cannot change roles');

reset role;

-- ---------------------------------------------------------------------------
-- Platform admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;

select isnt_empty(
  $$ update public.settings set value = '{"x":1}' where key = 'rls_test' returning key $$,
  'admin can change settings');
select isnt_empty(
  $$ update public.profiles set full_name = 'x' where id = '00000000-0000-0000-0000-0000000000c1' returning id $$,
  'admin can manage profiles');

reset role;

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is((select count(*)::int from public.reports), 0, 'anon reads no reports');
select is((select count(*)::int from public.profiles), 0, 'anon reads no profiles');
select is((select count(*)::int from public.official_domains), 0, 'anon reads no reference data directly');
select throws_ok($$ select * from public.public_threat_feed $$, '42501', null, 'public_threat_feed not readable by anon');
select throws_ok($$ select public.next_protocol() $$, '42501', null, 'anon cannot execute functions');

reset role;

select * from finish();
rollback;
