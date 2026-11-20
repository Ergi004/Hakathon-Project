-- Phishing Intelligence: where captured data is sent (docs/PHISHING-INTEL.md §Exfiltration).
-- New indicator type exfil_endpoint (Telegram bots, webhooks, form handlers…) with its kind and
-- non-secret details. Tokens are never stored: only an ID, a redacted form and a SHA-256.

alter table public.scan_iocs drop constraint scan_iocs_type_check;
alter table public.scan_iocs add constraint scan_iocs_type_check
  check (type in ('url','domain','ip','file_hash','email','phone_number','short_code','exfil_endpoint'));

alter table public.scan_iocs
  add column subtype text,
  add column detail jsonb not null default '{}';

-- Cross-scan correlation: "the same Telegram bot receives data from 40 different emails".
create index scan_iocs_exfil_idx on public.scan_iocs (normalized_value, created_at desc) where type = 'exfil_endpoint';
