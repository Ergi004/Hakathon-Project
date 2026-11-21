begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000006a1', 'an@demo.example', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006c1', 'ci@demo.example', 'authenticated', 'authenticated');
update public.profiles set platform_role = 'soc_analyst' where id = '00000000-0000-0000-0000-0000000006a1';
insert into public.scans (id, token_hash, url_sanitized, host, registrable_domain) values
  ('00000000-0000-0000-0000-0000000006f1', 'h', 'hxxps://x[.]test/', 'x.test', 'x.test');
insert into public.scan_results (scan_id, provider) values ('00000000-0000-0000-0000-0000000006f1', 'virustotal');
insert into public.intel_subdomains (scan_id, registrable_domain, subdomain, source) values ('00000000-0000-0000-0000-0000000006f1', 'x.test', 'a.x.test', 'crtsh');
insert into public.intel_cache (key, provider, payload, expires_at) values ('virustotal:k', 'virustotal', '{}', now() + interval '1 day');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.scans), 0, 'anon cannot read scans');
select is((select count(*)::int from public.scan_results), 0, 'anon cannot read scan_results');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006c1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.scans), 0, 'citizen cannot read scans');
select is((select count(*)::int from public.intel_subdomains), 0, 'citizen cannot read intel_subdomains');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.scans), 1, 'staff reads scans');
select is((select count(*)::int from public.scan_results), 1, 'staff reads scan_results');
select is((select count(*)::int from public.intel_cache), 0, 'nobody reads intel_cache through the API');
select throws_ok($$ insert into public.scan_results (scan_id, provider) values ('00000000-0000-0000-0000-0000000006f1', 'urlhaus') $$, '42501', null, 'staff cannot write scan_results directly');
reset role;
select * from finish();
rollback;
