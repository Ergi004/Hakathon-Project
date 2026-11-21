-- Geographic Threat Map: aggregates, hot spots and alert rules are staff-only; leads write rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000007a1', 'geo-analyst@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b1', 'geo-lead@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007c1', 'geo-citizen@demo.example', 'authenticated', 'authenticated');
update public.profiles set platform_role = 'soc_analyst' where id = '00000000-0000-0000-0000-0000000007a1';
update public.profiles set platform_role = 'soc_lead' where id = '00000000-0000-0000-0000-0000000007b1';

insert into public.regions (id, code, name_sq, level) values ('00000000-0000-0000-0000-0000000007e1', 'ZZ0001', 'Test', 'municipality');
-- The trigger turns a report with a region into an aggregate row (no text, no coordinates).
insert into public.reports (source, channel, flag, region_id, region_source) values ('citizen_report', 'sms', 'red', '00000000-0000-0000-0000-0000000007e1', 'user_selected');
select is((select sum(report_count)::int from public.region_daily_stats where region_id = '00000000-0000-0000-0000-0000000007e1' and mode = 'victim'), 1, 'trigger aggregates a new report into region_daily_stats');
insert into public.geo_hotspots (window_days, mode, region_id, observed, expected, zscore, severity) values (7, 'victim', '00000000-0000-0000-0000-0000000007e1', 12, 2, 7, 'critical');

-- Anonymous
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.region_daily_stats), 0, 'anon cannot read region_daily_stats');
select is((select count(*)::int from public.geo_hotspots), 0, 'anon cannot read geo_hotspots');
select is((select count(*)::int from public.geo_alert_rules), 0, 'anon cannot read geo_alert_rules');
select is((select count(*)::int from public.regions), 0, 'anon cannot read regions');
select throws_ok($$ select public.rebuild_region_stats() $$, '42501', null, 'anon cannot rebuild stats');
reset role;

-- Citizen
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.region_daily_stats), 0, 'citizen cannot read region_daily_stats');
select is((select count(*)::int from public.geo_hotspots), 0, 'citizen cannot read geo_hotspots');
select is((select count(*)::int from public.geo_alert_rules), 0, 'citizen cannot read geo_alert_rules');
select ok((select count(*) from public.regions where code = 'ZZ0001') = 1, 'citizen can read the region list');
select throws_ok($$ insert into public.geo_alert_rules (name) values ('x') $$, '42501', null, 'citizen cannot write alert rules');
reset role;

-- Analyst
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from public.region_daily_stats where region_id = '00000000-0000-0000-0000-0000000007e1') >= 1, 'analyst reads region_daily_stats');
select ok((select count(*) from public.geo_hotspots where region_id = '00000000-0000-0000-0000-0000000007e1') = 1, 'analyst reads geo_hotspots');
select ok((select count(*) from public.geo_alert_rules) >= 1, 'analyst reads geo_alert_rules');
select throws_ok($$ insert into public.geo_alert_rules (name) values ('x') $$, '42501', null, 'analyst cannot write alert rules');
select throws_ok($$ insert into public.region_daily_stats (day, mode, report_count) values (current_date, 'victim', 5) $$, '42501', null, 'staff cannot write aggregates directly');
reset role;

-- Lead
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ insert into public.geo_alert_rules (name, min_reports, created_by) values ('Lead rule', 6, '00000000-0000-0000-0000-0000000007b1') $$, 'lead can write alert rules');
reset role;

select * from finish();
rollback;
