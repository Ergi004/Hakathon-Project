import "server-only";

import type { AdminClient } from "@/server/db";
import { limit } from "@/server/rate-limit";
import type { ExtractedIoc, IocType, Reputation } from "../../types";
import { isPrivateIPv4 } from "../ioc-extractor";
import { createVtClient, VtError, type VtKind, type VtReport } from "./client";

const PROVIDER = "virustotal";
const NON_ROUTABLE = /\.(example|test|invalid|localhost|local|internal)$/i;
const KIND: Partial<Record<IocType, VtKind>> = { url: "url", domain: "domain", ip: "ip", file_hash: "file" };
/** File hashes first (no privacy cost, strongest signal), then domains, URLs, IPs. */
const PRIORITY: IocType[] = ["file_hash", "domain", "url", "ip"];

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function vtConfig() {
  return {
    apiKey: process.env.VT_API_KEY || process.env.VIRUS_TOTAL_API_KEY || undefined,
    baseUrl: process.env.VT_BASE_URL || "https://www.virustotal.com/api/v3",
    perMinute: num("VT_RATE_PER_MIN", 4),
    perDay: num("VT_RATE_PER_DAY", 500),
    maxPerScan: num("VT_MAX_LOOKUPS_PER_SCAN", 8),
    ttlHours: num("VT_CACHE_TTL_HOURS", 24),
    notFoundTtlHours: num("VT_NOT_FOUND_TTL_HOURS", 6),
  };
}

export interface ReputationOutcome {
  reputations: Reputation[];
  skipped: { type: IocType; value: string; reason: "synthetic" | "official" | "private_ip" | "quota" | "error" | "limit" }[];
  status: "completed" | "partial" | "skipped";
  note?: string;
}

/**
 * Cache → quota → VirusTotal for each eligible indicator (PDF §7.2 steps 12-16, §10).
 * Never throws: provider failures become a partial result with a reason.
 */
export async function lookupReputation(db: AdminClient, iocs: ExtractedIoc[], officialHosts: Set<string>): Promise<ReputationOutcome> {
  const cfg = vtConfig();
  const out: ReputationOutcome = { reputations: [], skipped: [], status: "completed" };
  if (!cfg.apiKey) return { ...out, status: "skipped", note: "VirusTotal is not configured" };

  const eligible: ExtractedIoc[] = [];
  for (const type of PRIORITY) {
    for (const i of iocs.filter((x) => x.type === type)) {
      const host = type === "url" ? safeHost(i.normalized) : i.normalized;
      if ((type === "domain" || type === "url") && host && NON_ROUTABLE.test(host)) out.skipped.push({ type, value: i.display, reason: "synthetic" });
      else if ((type === "domain" || type === "url") && host && officialHosts.has(host)) out.skipped.push({ type, value: i.display, reason: "official" });
      else if (type === "ip" && isPrivateIPv4(i.normalized)) out.skipped.push({ type, value: i.display, reason: "private_ip" });
      else eligible.push(i);
    }
  }
  const batch = eligible.slice(0, cfg.maxPerScan);
  for (const i of eligible.slice(cfg.maxPerScan)) out.skipped.push({ type: i.type, value: i.display, reason: "limit" });
  if (!batch.length) return out;

  const { data: cached } = await db
    .from("ioc_reputation")
    .select("*")
    .eq("provider", PROVIDER)
    .in("normalized_value", batch.map((b) => b.normalized))
    .gt("expires_at", new Date().toISOString());
  const cacheMap = new Map((cached ?? []).map((c) => [`${c.ioc_type}:${c.normalized_value}`, c]));

  const client = createVtClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
  let stop: string | null = null;

  for (const ioc of batch) {
    const hit = cacheMap.get(`${ioc.type}:${ioc.normalized}`);
    if (hit) {
      out.reputations.push({
        provider: PROVIDER,
        type: ioc.type,
        value: ioc.display,
        found: hit.found,
        malicious: hit.malicious ?? 0,
        suspicious: hit.suspicious ?? 0,
        harmless: hit.harmless ?? 0,
        undetected: hit.undetected ?? 0,
        reputation: hit.reputation,
        threatLabel: hit.threat_label,
        categories: hit.categories,
        lastAnalysisAt: hit.last_analysis_at,
        cached: true,
      });
      continue;
    }
    if (stop) {
      out.skipped.push({ type: ioc.type, value: ioc.display, reason: stop === "quota" ? "quota" : "error" });
      continue;
    }
    const perMin = await limit("vt:minute", cfg.perMinute, 60);
    const perDay = perMin.allowed ? await limit("vt:day", cfg.perDay, 86_400) : perMin;
    if (!perMin.allowed || !perDay.allowed) {
      stop = "quota";
      out.skipped.push({ type: ioc.type, value: ioc.display, reason: "quota" });
      continue;
    }
    let report: VtReport;
    try {
      report = await client.lookup(KIND[ioc.type]!, ioc.normalized);
    } catch (e) {
      const code = e instanceof VtError ? e.code : "upstream";
      stop = code === "quota" ? "quota" : code;
      out.note = `VirusTotal: ${code}`;
      out.skipped.push({ type: ioc.type, value: ioc.display, reason: code === "quota" ? "quota" : "error" });
      continue;
    }
    const ttl = (report.found ? cfg.ttlHours : cfg.notFoundTtlHours) * 3_600_000;
    await db.from("ioc_reputation").upsert(
      {
        provider: PROVIDER,
        ioc_type: ioc.type,
        normalized_value: ioc.normalized,
        found: report.found,
        malicious: report.malicious,
        suspicious: report.suspicious,
        harmless: report.harmless,
        undetected: report.undetected,
        reputation: report.reputation,
        threat_label: report.threatLabel,
        categories: report.categories,
        first_seen: report.firstSeen,
        last_analysis_at: report.lastAnalysisAt,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + ttl).toISOString(),
      },
      { onConflict: "provider,ioc_type,normalized_value" },
    );
    out.reputations.push({ provider: PROVIDER, type: ioc.type, value: ioc.display, ...report, cached: false });
  }

  if (out.skipped.some((s) => s.reason === "quota" || s.reason === "error")) out.status = "partial";
  return out;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
