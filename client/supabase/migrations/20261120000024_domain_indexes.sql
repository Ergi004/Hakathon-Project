-- Domain intelligence (/soc/domains) performance.
-- The page embeds each domain's certificates; without an index on certificates.domain_id every one of
-- the 50 domains on a page scanned all certificates (and evaluated RLS on each), which hit the 8 s
-- statement timeout once the dataset was seeded. Also index the page's sort and status filter, and the
-- campaign_domains lookup by domain.
create index if not exists certificates_domain_id_idx on public.certificates (domain_id);
create index if not exists domains_first_seen_idx on public.domains (first_seen_at desc);
create index if not exists domains_status_first_seen_idx on public.domains (status, first_seen_at desc);
create index if not exists campaign_domains_domain_id_idx on public.campaign_domains (domain_id);
