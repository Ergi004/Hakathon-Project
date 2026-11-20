-- RLS for migration citizen tables (SPEC 8): owner-only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000001c1', 'c1@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000001c2', 'c2@demo.example', 'authenticated', 'authenticated');
insert into public.checks (id, input_kind, input_hash, score, flag) values
  ('00000000-0000-0000-0000-00000000c0c1', 'url', 'h1', 70, 'red'),
  ('00000000-0000-0000-0000-00000000c0c2', 'url', 'h2', 10, 'green');
insert into public.user_check_links (user_id, check_id, kind) values
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-00000000c0c1', 'url'),
  ('00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-00000000c0c2', 'url');
insert into public.user_watch_items (user_id, kind, value_hash, label) values
  ('00000000-0000-0000-0000-0000000001c2', 'phone', 'x', '+355 69 *** **67');
insert into public.user_badges (user_id, badge) values ('00000000-0000-0000-0000-0000000001c2', 'first_check');
insert into public.messages (id, channel, language, body_masked, body_hash) values
  ('00000000-0000-0000-0000-00000000aa01', 'sms', 'sq', 'mine', 'h1'),
  ('00000000-0000-0000-0000-00000000aa02', 'sms', 'sq', 'theirs', 'h2');
insert into public.reports (source, reporter_id, message_id) values
  ('citizen_report', '00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-00000000aa01'),
  ('citizen_report', '00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-00000000aa02');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000001c1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.user_check_links), 1, 'sees only own check links');
select results_eq($$ select id from public.checks $$, $$ values ('00000000-0000-0000-0000-00000000c0c1'::uuid) $$, 'reads only own linked checks');
select is((select count(*)::int from public.user_watch_items), 0, 'cannot read another user watch items');
select throws_ok(
  $$ insert into public.user_watch_items (user_id, kind, value_hash, label) values ('00000000-0000-0000-0000-0000000001c2', 'phone', 'y', 'x') $$,
  '42501', null, 'cannot add watch items for someone else');
select lives_ok(
  $$ insert into public.user_watch_items (user_id, kind, value_hash, label) values ('00000000-0000-0000-0000-0000000001c1', 'phone', 'y', 'x') $$,
  'can add own watch item');
select throws_ok(
  $$ insert into public.user_badges (user_id, badge) values ('00000000-0000-0000-0000-0000000001c1', 'quiz_master') $$,
  '42501', null, 'cannot self-award badges');
select is((select count(*)::int from public.user_badges), 0, 'cannot read another user badges');
select throws_ok($$ update public.profiles set platform_role = 'soc_lead' where id = '00000000-0000-0000-0000-0000000001c1' $$, '42501', null, 'still cannot escalate role');

select results_eq($$ select body_masked from public.messages $$, $$ values ('mine') $$, 'citizen reads only messages of own reports');
select is((select count(*)::int from public.reports), 1, 'citizen reads only own reports');
reset role;
select * from finish();
rollback;
