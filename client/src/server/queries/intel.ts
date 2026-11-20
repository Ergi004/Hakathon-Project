import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanReport } from "@/server/phishing-intel/reporting/report-builder";
import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;

export const INTEL_CHANNELS = ["email", "sms"] as const;
export const INTEL_VERDICTS = ["malicious", "suspicious", "clean", "unknown"] as const;
export const INTEL_STATUSES = ["queued", "processing", "completed", "partial", "failed"] as const;

export interface IntelFilters {
  channel?: (typeof INTEL_CHANNELS)[number];
  verdict?: (typeof INTEL_VERDICTS)[number];
  status?: (typeof INTEL_STATUSES)[number];
  albania?: boolean;
  vtOnly?: boolean;
  /** Only scans where a data destination (bot, webhook, form handler…) was found. */
  exfilOnly?: boolean;
  page: number;
}

const PAGE = 25;

/** /soc/intel list. RLS (can_read_scan) lets analysts see every scan. */
export async function getIntelScans(db: DB, f: IntelFilters) {
  let q = db
    .from("phishing_scans")
    .select(
      "id, channel, source, status, verdict, risk_score, severity, phishing_type, phishing_family, malware_family, attribution_status, albania, albania_signals, vt_max_malicious, progress, created_at, completed_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((f.page - 1) * PAGE, f.page * PAGE - 1);
  if (f.channel) q = q.eq("channel", f.channel);
  if (f.verdict) q = q.eq("verdict", f.verdict);
  if (f.status) q = q.eq("status", f.status);
  if (f.albania) q = q.eq("albania", true);
  if (f.vtOnly) q = q.gt("vt_max_malicious", 0);
  if (f.exfilOnly) {
    const { data: hits } = await db.from("scan_iocs").select("scan_id").eq("type", "exfil_endpoint").order("created_at", { ascending: false }).limit(1000);
    const ids = [...new Set((hits ?? []).map((h) => h.scan_id))];
    if (!ids.length) return { rows: [], total: 0, page: f.page, pages: 1, exfil: {} as Record<string, string[]> };
    q = q.in("id", ids);
  }
  const { data, count } = await q;
  const rows = data ?? [];
  // Data-destination kinds per listed scan (one small query for the page).
  const exfil: Record<string, string[]> = {};
  if (rows.length) {
    const { data: ex } = await db.from("scan_iocs").select("scan_id, subtype").eq("type", "exfil_endpoint").in("scan_id", rows.map((r) => r.id));
    for (const e of ex ?? []) (exfil[e.scan_id] ??= []).push(e.subtype ?? "form_action");
  }
  return { rows, total: count ?? 0, page: f.page, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)), exfil };
}

/** KPI strip for the last 24 hours, respecting the Albania filter. */
export async function getIntelKpis(db: DB, albania: boolean) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const base = () => {
    const q = db.from("phishing_scans").select("id", { count: "exact", head: true }).gte("created_at", since);
    return albania ? q.eq("albania", true) : q;
  };
  const exfilQ = albania
    ? db.from("scan_iocs").select("id, phishing_scans!inner(albania)", { count: "exact", head: true }).eq("phishing_scans.albania", true)
    : db.from("scan_iocs").select("id", { count: "exact", head: true });
  const [total, sms, malicious, vtHits, exfil] = await Promise.all([
    base(),
    base().eq("channel", "sms"),
    base().eq("verdict", "malicious"),
    base().gt("vt_max_malicious", 0),
    exfilQ.eq("type", "exfil_endpoint").gte("created_at", since),
  ]);
  return {
    total: total.count ?? 0,
    sms: sms.count ?? 0,
    email: (total.count ?? 0) - (sms.count ?? 0),
    malicious: malicious.count ?? 0,
    vtHits: vtHits.count ?? 0,
    exfil: exfil.count ?? 0,
  };
}

export async function getIntelScan(db: DB, id: string) {
  const [{ data: scan }, { data: report }, { data: events }] = await Promise.all([
    db.from("phishing_scans").select("*").eq("id", id).maybeSingle(),
    db.from("scan_reports").select("report").eq("scan_id", id).maybeSingle(),
    db.from("scan_events").select("id, stage, status, message, created_at").eq("scan_id", id).order("id").limit(200),
  ]);
  if (!scan) return null;
  const [related, landing, urls] = await Promise.all([
    relatedScans(db, id),
    db.from("landing_analyses").select("*").eq("scan_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("scan_iocs").select("normalized_value").eq("scan_id", id).eq("type", "url").order("created_at").limit(30),
  ]);
  return {
    scan,
    report: (report?.report as unknown as ScanReport | undefined) ?? null,
    events: events ?? [],
    related,
    landing: landing.data ?? [],
    landingCandidates: (urls.data ?? []).map((u) => u.normalized_value),
  };
}

/**
 * Live correlation for the detail page: other scans whose data goes to the same
 * endpoint (counted now, so it grows as new emails arrive).
 */
async function relatedScans(db: DB, id: string): Promise<Record<string, { scans: number; latest: { id: string; created_at: string }[] }>> {
  const { data: mine } = await db.from("scan_iocs").select("normalized_value").eq("scan_id", id).eq("type", "exfil_endpoint");
  const keys = (mine ?? []).map((m) => m.normalized_value);
  if (!keys.length) return {};
  const { data } = await db
    .from("scan_iocs")
    .select("normalized_value, scan_id, created_at")
    .eq("type", "exfil_endpoint")
    .in("normalized_value", keys)
    .neq("scan_id", id)
    .order("created_at", { ascending: false })
    .limit(500);
  const out: Record<string, { scans: number; latest: { id: string; created_at: string }[] }> = {};
  for (const row of data ?? []) {
    const e = (out[row.normalized_value] ??= { scans: 0, latest: [] });
    e.scans += 1;
    if (e.latest.length < 5) e.latest.push({ id: row.scan_id, created_at: row.created_at });
  }
  return out;
}
