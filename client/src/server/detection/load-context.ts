import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/flags";
import { tryAdmin } from "@/server/db";
import type { Enums } from "@/types/database";
import { createContext, type ContextData, type DetectionContext } from "./context";
import { hostOf } from "./normalize";
import { countDistinctReporters, type ReportSighting } from "./reporters";

/** Detection data from the database, cached for a minute (invalidated by tag "detection"). */
export async function loadContextData(): Promise<ContextData> {
  "use cache";
  cacheLife("minutes");
  cacheTag("detection");

  const db = tryAdmin();
  const empty: ContextData = { institutions: [], officialDomains: [], officialChannels: [], thresholds: DEFAULT_THRESHOLDS };
  if (!db) return empty;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [inst, od, oc, doms, certs, iocs, block, hashes, settings, reports, audits] = await Promise.all([
    db.from("institutions").select("id, name, slug"),
    db.from("official_domains").select("domain, institution_id").eq("verified", true),
    db.from("official_channels").select("kind, value, institution_id"),
    db.from("domains").select("domain, registered_at, age_days, registrar, nameserver, hosting_country, privacy, status").neq("status", "allowlisted").limit(5000),
    db.from("certificates").select("domain_id, not_before, san, domains(domain)").limit(5000),
    db.from("iocs").select("type, value, campaigns!inner(id, code, status)").limit(10000),
    db.from("blocklist_entries").select("type, value, expires_at"),
    db.from("known_hashes").select("hash").limit(20000),
    db.from("settings").select("key, value").in("key", ["thresholds"]),
    db.from("reports").select("id, reporter_id, messages(urls)").gte("created_at", since).limit(1000),
    db.from("audit_log").select("entity_id, ip_hash").eq("action", "report.create").gte("created_at", since).limit(1000),
  ]);

  const certByDomain = new Map<string, { notBefore: string | null; san: string[] }>();
  for (const c of certs.data ?? []) {
    const d = (c.domains as { domain: string } | null)?.domain;
    if (d) certByDomain.set(d, { notBefore: c.not_before, san: c.san });
  }
  const now = Date.now();
  const iocKind = (t: string) => (t === "domain" || t === "url" || t === "phone" || t === "email" ? t : null);

  return {
    institutions: (inst.data ?? []).map((i) => ({ id: i.id, name: i.name, aliases: [i.slug] })),
    officialDomains: (od.data ?? []).map((d) => ({ domain: d.domain, institutionId: d.institution_id })),
    officialChannels: (oc.data ?? []).map((c) => ({ kind: c.kind as "sms_sender" | "phone" | "social" | "email", value: c.value, institutionId: c.institution_id })),
    domainIntel: (doms.data ?? []).map((d) => ({
      domain: d.domain,
      registeredAt: d.registered_at,
      ageDays: d.age_days,
      registrar: d.registrar,
      nameserver: d.nameserver,
      hostingCountry: d.hosting_country,
      privacy: d.privacy,
      certNotBefore: certByDomain.get(d.domain)?.notBefore ?? null,
      certSan: certByDomain.get(d.domain)?.san ?? [],
    })),
    campaignIocs: (iocs.data ?? []).flatMap((i) => {
      const kind = iocKind(i.type);
      const c = i.campaigns as { id: string; code: string; status: Enums<"campaign_status"> } | null;
      if (!kind || !c) return [];
      const value = kind === "domain" ? hostOf(i.value) ?? i.value : i.value.replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http");
      return [{ kind, value, campaign: { id: c.id, code: c.code, status: c.status } }];
    }),
    blocklist: (block.data ?? []).flatMap((b) => {
      const kind = iocKind(b.type);
      if (!kind || (b.expires_at && Date.parse(b.expires_at) < now)) return [];
      return [{ kind, value: b.value.replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http") }];
    }),
    knownHashes: (hashes.data ?? []).map((h) => h.hash),
    recentReporters: countDistinctReporters(sightings(reports.data ?? [], audits.data ?? [])),
    thresholds: { ...DEFAULT_THRESHOLDS, ...((settings.data?.[0]?.value as Partial<Thresholds> | undefined) ?? {}) },
  };
}

function sightings(
  reports: { id: string; reporter_id: string | null; messages: { urls: string[] | null } | { urls: string[] | null }[] | null }[],
  audits: { entity_id: string | null; ip_hash: string | null }[],
): ReportSighting[] {
  const ipByReport = new Map<string, string>();
  for (const row of audits) {
    if (row.entity_id && row.ip_hash) ipByReport.set(row.entity_id, row.ip_hash);
  }
  return reports.flatMap((report) => {
    const message = Array.isArray(report.messages) ? report.messages[0] : report.messages;
    return [{
      urls: message?.urls ?? [],
      reporterId: report.reporter_id,
      ipHash: ipByReport.get(report.id) ?? null,
    }];
  });
}

export async function loadContext(): Promise<DetectionContext> {
  return createContext(await loadContextData());
}
