-- Campaign insights (migration 26) run with the caller's RLS: citizens see nothing of the SOC panel.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000026c1', 'ci@demo.example', 'authenticated', 'authenticated');
insert into public.campaigns (id, code, tactic, status, severity) values
  ('00000000-0000-0000-0000-0000000026aa', 'TEST-26', 'credential_harvest', 'confirmed', 'high');
insert into public.reports (source, campaign_id) values ('feed', '00000000-0000-0000-0000-0000000026aa');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000026c1","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.campaign_report_counts), 0, 'citizen sees no campaign report counts');
select is(jsonb_array_length(public.soc_campaign_overview(12) -> 'matrix'), 0, 'citizen sees no campaign matrix');
select is(jsonb_array_length(public.soc_campaign_overview(12) -> 'top'), 0, 'citizen sees no active campaigns');

reset role;
select * from finish();
rollback;
