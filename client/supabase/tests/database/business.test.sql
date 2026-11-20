begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000003b1', 'b1@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000003b2', 'b2@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000003c1', 'c1@demo.example', 'authenticated', 'authenticated');
insert into public.organizations (id, type, name, slug) values
  ('00000000-0000-0000-0000-00000000003a', 'business', 'Bank A', 'bank-a'),
  ('00000000-0000-0000-0000-00000000003b', 'business', 'Bank B', 'bank-b');
insert into public.organization_members (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000003a', '00000000-0000-0000-0000-0000000003b1', 'viewer'),
  ('00000000-0000-0000-0000-00000000003b', '00000000-0000-0000-0000-0000000003b2', 'owner');
insert into public.institutions (id, slug, name, sector, organization_id) values
  ('00000000-0000-0000-0000-0000000003ea', 'bank-a', 'Bank A', 'bank', '00000000-0000-0000-0000-00000000003a'),
  ('00000000-0000-0000-0000-0000000003eb', 'bank-b', 'Bank B', 'bank', '00000000-0000-0000-0000-00000000003b');
insert into public.campaigns (id, code, tactic, institution_id) values
  ('00000000-0000-0000-0000-0000000003fa', 'T-A', 'bank_otp', '00000000-0000-0000-0000-0000000003ea'),
  ('00000000-0000-0000-0000-0000000003fb', 'T-B', 'bank_otp', '00000000-0000-0000-0000-0000000003eb');
insert into public.domains (id, domain, imitates_institution_id) values
  ('00000000-0000-0000-0000-0000000003da', 'bank-a-verify.example', '00000000-0000-0000-0000-0000000003ea'),
  ('00000000-0000-0000-0000-0000000003db', 'bank-b-verify.example', '00000000-0000-0000-0000-0000000003eb');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
set local role authenticated;
select results_eq($$ select code from public.campaigns $$, $$ values ('T-A') $$, 'business sees only campaigns imitating its own institution');
select results_eq($$ select domain from public.domains $$, $$ values ('bank-a-verify.example') $$, 'business sees only lookalikes of its own brand');
select is_empty($$ update public.campaigns set status = 'resolved' returning id $$, 'business cannot change campaigns');
select is_empty($$ update public.domains set status = 'allowlisted' returning id $$, 'business cannot change domains directly');
select is_empty($$ update public.organizations set name = 'x' where id = '00000000-0000-0000-0000-00000000003a' returning id $$, 'viewer cannot edit org settings');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.campaigns), 0, 'citizen sees no campaigns');
select is((select count(*)::int from public.domains), 0, 'citizen sees no domains');
reset role;
select * from finish();
rollback;
