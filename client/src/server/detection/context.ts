/**
 * Everything analyze() needs from the database, loaded by the caller
 * (Route Handler, cron, seed) so the engine itself stays pure and testable.
 */
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/flags";
import type { Enums } from "@/types/database";
import { foldText, hostOf, normalizePhone } from "./normalize";

export interface Institution {
  id: string;
  name: string;
  /** Extra names people use, e.g. "e-albania", "posta". Folded on load. */
  aliases?: string[];
}

export interface DomainIntel {
  domain: string;
  registeredAt?: string | null;
  ageDays?: number | null;
  registrar?: string | null;
  nameserver?: string | null;
  hostingCountry?: string | null;
  privacy?: boolean | null;
  certNotBefore?: string | null;
  certSan?: string[];
}

export interface CampaignRef {
  id: string;
  code: string;
  status: Enums<"campaign_status">;
}

export type IocKind = "domain" | "url" | "phone" | "email" | "sender";

/** A blocklist row. Missing provenance stays unverified and undated, so it is not treated as stale. */
export interface BlocklistEntry {
  kind: IocKind;
  value: string;
  source?: string;
  /** ISO time the entry was added. */
  addedAt?: string;
  /** True only when an analyst or a trusted feed has confirmed the listing. */
  verified?: boolean;
  /** ISO time of the latest confirmation. A recent one keeps an old entry from going stale. */
  confirmedAt?: string | null;
}

export interface BlocklistHit {
  source: string;
  addedAt: string | null;
  verified: boolean;
  confirmedAt: string | null;
}

export interface ContextData {
  institutions: Institution[];
  officialDomains: { domain: string; institutionId: string }[];
  officialChannels: { kind: "sms_sender" | "phone" | "social" | "email"; value: string; institutionId: string }[];
  domainIntel?: DomainIntel[];
  /** IoCs already linked to campaigns (SPEC 6.4 step 1). */
  campaignIocs?: { kind: IocKind; value: string; campaign: CampaignRef }[];
  blocklist?: BlocklistEntry[];
  /** sha256 hashes from known_hashes (see hash.ts hashInput). */
  knownHashes?: string[];
  /** Independent reporters in the last 24 h per IoC value. */
  recentReporters?: { kind: IocKind; value: string; count: number }[];
  /** Registrar|hosting-country pairs frequently seen in campaigns. */
  riskyInfra?: { registrar: string; hostingCountry: string }[];
  thresholds?: Thresholds;
}

export interface DetectionContext {
  institutions: Map<string, Institution & { folded: string[] }>;
  officialDomains: Map<string, string>;
  officialChannels: Map<string, string>;
  domainIntel: Map<string, DomainIntel>;
  campaignIocs: Map<string, CampaignRef>;
  blocklist: Map<string, BlocklistHit>;
  knownHashes: Set<string>;
  recentReporters: Map<string, number>;
  riskyInfra: Set<string>;
  thresholds: Thresholds;
}

/** Canonical lookup key for an IoC value. */
export function iocKey(kind: IocKind, value: string): string {
  switch (kind) {
    case "domain":
      return `domain:${hostOf(value) ?? value.toLowerCase()}`;
    case "url":
      return `url:${value.trim().toLowerCase()}`;
    case "phone":
      return `phone:${normalizePhone(value)}`;
    case "email":
      return `email:${value.trim().toLowerCase()}`;
    case "sender":
      return `sender:${value.trim().toLowerCase()}`;
  }
}

export function channelKey(kind: string, value: string): string {
  const v = kind === "phone" ? normalizePhone(value) : value.trim().toLowerCase();
  return `${kind}:${v}`;
}

function blocklistHit(entry: BlocklistEntry): BlocklistHit {
  return {
    source: entry.source?.trim() || "unspecified",
    addedAt: entry.addedAt ?? null,
    verified: entry.verified === true,
    confirmedAt: entry.confirmedAt ?? null,
  };
}

export function createContext(data: ContextData): DetectionContext {
  return {
    institutions: new Map(
      data.institutions.map((i) => [
        i.id,
        { ...i, folded: [i.name, ...(i.aliases ?? [])].map(foldText).filter((s) => s.length >= 4) },
      ]),
    ),
    officialDomains: new Map(data.officialDomains.map((d) => [d.domain.toLowerCase(), d.institutionId])),
    officialChannels: new Map(data.officialChannels.map((c) => [channelKey(c.kind, c.value), c.institutionId])),
    domainIntel: new Map((data.domainIntel ?? []).map((d) => [d.domain.toLowerCase(), d])),
    campaignIocs: new Map((data.campaignIocs ?? []).map((i) => [iocKey(i.kind, i.value), i.campaign])),
    blocklist: new Map((data.blocklist ?? []).map((entry) => [iocKey(entry.kind, entry.value), blocklistHit(entry)])),
    knownHashes: new Set(data.knownHashes ?? []),
    recentReporters: new Map((data.recentReporters ?? []).map((r) => [iocKey(r.kind, r.value), r.count])),
    riskyInfra: new Set(
      (data.riskyInfra ?? []).map((r) => `${r.registrar.toLowerCase()}|${r.hostingCountry.toLowerCase()}`),
    ),
    thresholds: data.thresholds ?? DEFAULT_THRESHOLDS,
  };
}
