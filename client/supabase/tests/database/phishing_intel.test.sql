-- RLS for the Phishing Intelligence Scanner (docs/PHISHING-INTEL.md): owners and staff read, nobody writes from a client.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000005a1', 'pi1@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005a2', 'pi2@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000005a3', 'pi-soc@demo.example', 'authenticated', 'authenticated');
update public.profiles set platform_role = 'soc_analyst' where id = '00000000-0000-0000-0000-0000000005a3';

insert into public.phishing_scans (id, owner_key, owner_user_id, idempotency_key, channel, source, input) values
  ('00000000-0000-0000-0000-0000000005b1', 'user:00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a1', 'k1', 'email', 'gmail', '{}'),
  ('00000000-0000-0000-0000-0000000005b2', 'user:00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000005a2', 'k2', 'sms', 'manual_input', '{}');
insert into public.scan_iocs (scan_id, type, value, normalized_value, location) values
  ('00000000-0000-0000-0000-0000000005b1', 'domain', 'a[.]test', 'a.test', 'body'),
  ('00000000-0000-0000-0000-0000000005b2', 'phone_number', '+355690000000', '+355690000000', 'sender');
insert into public.scan_reports (scan_id, channel, report) values
  ('00000000-0000-0000-0000-0000000005b1', 'email', '{"v":1}'),
  ('00000000-0000-0000-0000-0000000005b2', 'sms', '{"v":2}');
insert into public.ioc_reputation (provider, ioc_type, normalized_value, found, expires_at) values ('virustotal', 'domain', 'a.test', false, now() + interval '1 hour');
insert into public.threat_actors (id, name) values ('00000000-0000-0000-0000-0000000005c1', 'Test Actor');
insert into public.actor_evidence (actor_id, ioc_type, ioc_value, kind, source) values ('00000000-0000-0000-0000-0000000005c1', 'domain', 'a.test', 'infrastructure', 'test');

-- User 1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$ select id from public.phishing_scans $$, $$ values ('00000000-0000-0000-0000-0000000005b1'::uuid) $$, 'user reads only own scans');
select is((select count(*)::int from public.scan_iocs), 1, 'user reads only own scan indicators (no one else''s phone numbers)');
select is((select count(*)::int from public.scan_reports where scan_id = '00000000-0000-0000-0000-0000000005b2'), 0, 'cross-user report access denied');
select is((select count(*)::int from public.ioc_reputation), 0, 'reputation cache is staff-only');
select is((select count(*)::int from public.threat_actors), 1, 'signed-in users read actor reference records');
select is((select count(*)::int from public.actor_evidence), 0, 'actor evidence is staff-only');
select throws_ok(
  $$ insert into public.phishing_scans (owner_key, owner_user_id, idempotency_key, channel, source, input) values ('user:00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a1', 'k3', 'email', 'gmail', '{}') $$,
  '42501', null, 'clients cannot create scans directly (server only)');
update public.phishing_scans set verdict = 'clean' where id = '00000000-0000-0000-0000-0000000005b1';
reset role;
select is((select verdict from public.phishing_scans where id = '00000000-0000-0000-0000-0000000005b1'), 'unknown', 'clients cannot change a verdict');

-- SOC analyst
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a3","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.phishing_scans), 2, 'staff read all scans');
select is((select count(*)::int from public.ioc_reputation), 1, 'staff read the reputation cache');
select is((select count(*)::int from public.actor_evidence), 1, 'staff read actor evidence');
select throws_ok(
  $$ insert into public.threat_actors (name) values ('Analyst Actor') $$,
  '42501', null, 'only leads curate actors');
reset role;

select * from finish();
rollback;
