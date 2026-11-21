-- Stat-count views and aggregate functions (migration 25) must not widen what a caller can read.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000025c1', 'p1@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000025c2', 'p2@demo.example', 'authenticated', 'authenticated');
insert into public.messages (id, channel, language, body_masked, body_hash) values
  ('00000000-0000-0000-0000-0000000025a1', 'sms', 'sq', 'one', 'p1'),
  ('00000000-0000-0000-0000-0000000025a2', 'sms', 'sq', 'two', 'p2'),
  ('00000000-0000-0000-0000-0000000025a3', 'sms', 'sq', 'three', 'p3');
insert into public.reports (source, reporter_id, message_id) values
  ('citizen_report', '00000000-0000-0000-0000-0000000025c1', '00000000-0000-0000-0000-0000000025a1'),
  ('citizen_report', '00000000-0000-0000-0000-0000000025c2', '00000000-0000-0000-0000-0000000025a2'),
  ('citizen_report', '00000000-0000-0000-0000-0000000025c2', '00000000-0000-0000-0000-0000000025a3');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000025c1","role":"authenticated"}', true);
set local role authenticated;

select is((select coalesce(sum(n), 0)::int from public.report_status_counts_by_reporter), 1, 'citizen counts only own reports');
select is(
  (select coalesce(sum(n), 0)::int from public.report_status_counts_by_reporter where reporter_id = '00000000-0000-0000-0000-0000000025c2'),
  0, 'citizen cannot count another reporter''s reports');
select is((select count(*)::int from public.campaign_status_counts), 0, 'citizen sees no campaign counts');
select is((select count(*)::int from public.takedown_status_counts), 0, 'citizen sees no takedown counts');
select is((select count(*)::int from public.advisory_status_counts), 0, 'citizen sees no advisory counts');
select throws_ok($$ select * from public.public_threat_feed_counts $$, '42501', null, 'feed counts are server-side only');
select is(
  (select coalesce(jsonb_array_length(public.soc_pattern_stats(90) -> 'channels'), 0)),
  0, 'pattern stats run with the caller''s RLS (citizen sees no SOC aggregates)');
select is((select count(*)::int from public.soc_institution_spikes(now() - interval '1 day', 1)), 0, 'spikes run with the caller''s RLS');

reset role;
select * from finish();
rollback;
