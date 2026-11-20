begin;
create extension if not exists pgtap with schema extensions;
select plan(4);
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000002a1', 'a@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000002c1', 'c@demo.example', 'authenticated', 'authenticated');
update public.profiles set platform_role = 'soc_analyst' where id = '00000000-0000-0000-0000-0000000002a1';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ insert into public.saved_views (user_id, name, filters) values ('00000000-0000-0000-0000-0000000002a1', 'High risk', '{"flag":"red"}') $$, 'analyst saves a view');
select is((select count(*)::int from public.saved_views), 1, 'analyst sees own view');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into public.saved_views (user_id, name) values ('00000000-0000-0000-0000-0000000002c1', 'x') $$, '42501', null, 'citizen cannot save SOC views');
select is((select count(*)::int from public.soc_daily_volume), 0, 'citizen sees no SOC aggregates');
reset role;
select * from finish();
rollback;
