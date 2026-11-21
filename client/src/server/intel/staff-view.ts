import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntelState } from "@/components/intel/intel-panel";
import type { Database } from "@/types/database";

/** Latest scan of a report for staff (RLS: staff only), shaped for IntelPanel. */
export async function latestScanState(db: SupabaseClient<Database>, reportId: string): Promise<{ state: IntelState; domain: string } | null> {
  const { data: scan } = await db.from("scans").select("id, status, mock, domain_age_days, registered_at, registrable_domain").eq("report_id", reportId).eq("tier", "A").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!scan) return null;
  const { data: kids } = await db.from("scans").select("id, status").eq("parent_scan_id", scan.id);
  const kidIds = (kids ?? []).map((k) => k.id);
  const [{ data: rows }, { data: subs }] = await Promise.all([
    db.from("scan_results").select("scan_id, provider, status, verdict, malicious_count, total_count, summary, report_url, error").in("scan_id", [scan.id, ...kidIds]),
    db.from("intel_subdomains").select("subdomain, source, resolves, first_cert_at, verdict, brand_token").eq("scan_id", scan.id),
  ]);
  const running = scan.status === "running" || (kids ?? []).some((k) => k.status === "running");
  return {
    domain: scan.registrable_domain,
    state: {
      status: running ? "running" : (scan.status as IntelState["status"]),
      mock: scan.mock,
      domainAgeDays: scan.domain_age_days,
      registeredAt: scan.registered_at,
      rows: (rows ?? []).map((r) => {
        const tier = kidIds.includes(r.scan_id) ? "B" : "A";
        const summary = Object.fromEntries(Object.entries((r.summary ?? {}) as Record<string, unknown>).filter(([k]) => k !== "ref" && k !== "names"));
        return { key: `${tier}:${r.provider}`, provider: r.provider, tier, status: r.status, verdict: r.verdict, maliciousCount: r.malicious_count, totalCount: r.total_count, summary, reportUrl: r.report_url, error: r.error };
      }),
      subdomains: (subs ?? []).map((s) => ({ subdomain: s.subdomain.replace(/\./g, "[.]"), source: s.source, resolves: s.resolves, firstCertAt: s.first_cert_at, verdict: s.verdict, brandToken: s.brand_token })),
    },
  };
}

/** Latest verdict, age and subdomain count per registrable domain (domain tables, campaign pages). */
export async function latestVerdicts(db: SupabaseClient<Database>, domains: string[]) {
  const map = new Map<string, { verdict: string; ageDays: number | null; subdomains: number }>();
  if (!domains.length) return map;
  const { data } = await db.from("scans").select("id, registrable_domain, verdict, domain_age_days, created_at").eq("tier", "A").in("registrable_domain", domains).order("created_at", { ascending: false }).limit(2000);
  const latest = new Map<string, { id: string; verdict: string; domain_age_days: number | null }>();
  for (const s of data ?? []) if (!latest.has(s.registrable_domain)) latest.set(s.registrable_domain, s);
  const ids = [...latest.values()].map((s) => s.id);
  const { data: subs } = ids.length ? await db.from("intel_subdomains").select("scan_id").in("scan_id", ids) : { data: [] };
  for (const [d, s] of latest) map.set(d, { verdict: s.verdict, ageDays: s.domain_age_days, subdomains: (subs ?? []).filter((x) => x.scan_id === s.id).length });
  return map;
}
