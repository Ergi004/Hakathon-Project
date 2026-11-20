import "server-only";

import type { AdminClient } from "@/server/db";
import { safeEqualHex, sha256 } from "@/server/hash";

/** Fields that may appear in a provider summary; anything else is dropped before it leaves the server. */
const SAFE_KEYS = new Set([
  "malicious", "suspicious", "harmless", "undetected", "creationDate", "registrar", "categories", "deep", "notFound", "cached",
  "listed", "urlCount", "threats", "firstSeen", "blacklists", "registeredAt", "expiresAt", "privacy",
  "firstCertAt", "count", "resolves", "verdict", "threatScore", "state", "lookalike", "imitates", "punycode", "oddTld", "phase",
]);

function clean(summary: unknown): Record<string, unknown> {
  const o = summary && typeof summary === "object" ? (summary as Record<string, unknown>) : {};
  return Object.fromEntries(Object.entries(o).filter(([k]) => SAFE_KEYS.has(k)));
}

export interface ScanSnapshot {
  scan: { id: string; status: string; verdict: string; baseScore: number | null; finalScore: number | null; domainAgeDays: number | null; registeredAt: string | null; mock: boolean; host: string; registrableDomain: string; deep: boolean };
  results: { key: string; provider: string; tier: "A" | "B"; status: string; verdict: string; maliciousCount: number | null; totalCount: number | null; summary: Record<string, unknown>; reportUrl: string | null; error: string | null; finishedAt: string | null }[];
  subdomains: { subdomain: string; source: string; resolves: boolean | null; firstCertAt: string | null; verdict: string; brandToken: boolean }[];
}

export async function verifyScanToken(db: AdminClient, scanId: string, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return false;
  const { data } = await db.from("scans").select("token_hash").eq("id", scanId).maybeSingle();
  return !!data && safeEqualHex(data.token_hash, sha256(token));
}

/** Normalised view of a scan and its tier B child. Never contains raw provider payloads. */
export async function getScanSnapshot(db: AdminClient, scanId: string): Promise<ScanSnapshot | null> {
  const { data: scan } = await db.from("scans").select("*").eq("id", scanId).maybeSingle();
  if (!scan) return null;
  const { data: children } = await db.from("scans").select("id, status").eq("parent_scan_id", scanId);
  const childIds = (children ?? []).map((c) => c.id);
  const [{ data: rows }, { data: subs }] = await Promise.all([
    db.from("scan_results").select("scan_id, provider, status, verdict, malicious_count, total_count, summary, report_url, error, finished_at").in("scan_id", [scanId, ...childIds]).order("finished_at", { ascending: true, nullsFirst: false }),
    db.from("intel_subdomains").select("subdomain, source, resolves, first_cert_at, verdict, brand_token").eq("scan_id", scanId).order("brand_token", { ascending: false }),
  ]);
  const deepRunning = (children ?? []).some((c) => c.status === "running");
  return {
    scan: {
      id: scan.id,
      status: scan.status === "done" && deepRunning ? "running" : scan.status,
      verdict: scan.verdict,
      baseScore: scan.base_score,
      finalScore: scan.final_score,
      domainAgeDays: scan.domain_age_days,
      registeredAt: scan.registered_at,
      mock: scan.mock,
      host: scan.host.replace(/\./g, "[.]"),
      registrableDomain: scan.registrable_domain.replace(/\./g, "[.]"),
      deep: childIds.length > 0,
    },
    results: (rows ?? []).map((r) => {
      const tier = childIds.includes(r.scan_id) ? "B" : "A";
      return { key: `${tier}:${r.provider}`, provider: r.provider, tier, status: r.status, verdict: r.verdict, maliciousCount: r.malicious_count, totalCount: r.total_count, summary: clean(r.summary), reportUrl: r.report_url, error: r.error, finishedAt: r.finished_at };
    }),
    subdomains: (subs ?? []).map((s) => ({ subdomain: s.subdomain.replace(/\./g, "[.]"), source: s.source, resolves: s.resolves, firstCertAt: s.first_cert_at, verdict: s.verdict, brandToken: s.brand_token })),
  };
}
