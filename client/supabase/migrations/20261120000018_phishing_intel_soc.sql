-- Phishing Intelligence in the SOC (docs/PHISHING-INTEL.md §SOC): Albania scope, VirusTotal summary, Realtime.

alter table public.phishing_scans
  add column albania boolean not null default false,
  add column albania_signals text[] not null default '{}',
  add column vt_max_malicious int;

create index phishing_scans_albania_idx on public.phishing_scans (albania, created_at desc);

-- Live updates for /soc/intel. Realtime applies RLS (phishing_scans_read → can_read_scan), so analysts see every scan and owners only theirs.
alter publication supabase_realtime add table public.phishing_scans;
