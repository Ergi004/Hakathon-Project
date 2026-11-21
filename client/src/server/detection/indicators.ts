/**
 * Per-indicator breakdown of a scan: every domain, link, phone number and email address found
 * in the submitted text, each with its own risk. Built from signals analyze() already computed;
 * nothing here adds points to the overall score. Values are defanged for display.
 */
import { iocKey, channelKey, type DetectionContext } from "./context";
import { parseHost, scoreDomain, type LookalikeClass } from "./domain-score";
import { defang, hostOf } from "./normalize";
import type { HostSignal } from "./pattern";
import type { Reason } from "./types";

/** official: a verified institution domain/channel. no_signals: nothing found against it, but not verified either. */
export type IndicatorLevel = "official" | "no_signals" | "low" | "suspicious" | "high" | "malicious";

export interface DomainIndicator {
  value: string;
  registrable: string;
  level: IndicatorLevel;
  /** 0–100 risk for this domain alone. */
  risk: number;
  lookalike: { cls: LookalikeClass; imitates: string } | null;
  ageDays: number | null;
  hostingCountry: string | null;
  registrar: string | null;
  /** Campaign this exact domain is linked to (IoC), if any. */
  campaignCode: string | null;
  /** Reason codes that point at this domain. */
  signals: string[];
  urls: string[];
}

export interface ContactIndicator {
  value: string;
  level: IndicatorLevel;
  campaignCode: string | null;
}

export interface ScanIndicators {
  domains: DomainIndicator[];
  phones: ContactIndicator[];
  emails: ContactIndicator[];
}

/** Reputation codes that settle a domain as malicious on their own. */
const MALICIOUS = new Set(["known_bad", "confirmed_campaign", "intel_malicious"]);
/** Links-group cap (SPEC 6.3): a domain that maxes out the group reads as 100. */
const LINKS_CAP = 30;

export function levelFor(risk: number): IndicatorLevel {
  if (risk >= 100) return "malicious";
  if (risk >= 60) return "high";
  if (risk >= 25) return "suspicious";
  if (risk > 0) return "low";
  return "no_signals";
}

export function buildIndicators(a: {
  hosts: string[];
  allUrls: string[];
  officialHosts: Set<string>;
  hostSignals: HostSignal[];
  reasons: Reason[];
  phones: string[];
  emails: string[];
  /** Set when the sender matched an official channel; only that address is marked official. */
  officialSenderId?: string;
  senderAddress?: string | null;
  ctx: DetectionContext;
}): ScanIndicators {
  const domains = a.hosts.map((host): DomainIndicator => {
    const shown = defang(host);
    const signal = a.hostSignals.find((h) => h.domain.host === host);
    const urls = a.allUrls.filter((u) => hostOf(u) === host).map(defang);
    const campaign = a.ctx.campaignIocs.get(iocKey("domain", host)) ?? urls.map((u) => a.ctx.campaignIocs.get(iocKey("url", u))).find(Boolean) ?? null;
    // A reason points at this domain when its evidence names the host or one of its links.
    const own = a.reasons.filter((r) => r.evidence && (r.evidence.includes(shown) || urls.includes(r.evidence)));
    const official = a.officialHosts.has(host);
    const sum = own.reduce((s, r) => s + r.weight, 0);
    const risk = official ? 0 : own.some((r) => MALICIOUS.has(r.code)) ? 100 : Math.min(95, Math.round((sum / LINKS_CAP) * 100));
    return {
      value: shown,
      registrable: defang(parseHost(host).registrable),
      level: official ? "official" : levelFor(risk),
      risk,
      lookalike: signal?.domain.lookalike ? { cls: signal.domain.lookalike.cls, imitates: defang(signal.domain.lookalike.imitates) } : null,
      ageDays: signal?.whois?.ageDays ?? signal?.intel?.ageDays ?? null,
      hostingCountry: signal?.intel?.hostingCountry ?? null,
      registrar: signal?.intel?.registrar ?? null,
      campaignCode: campaign?.code ?? null,
      signals: [...new Set(own.map((r) => r.code))],
      urls,
    };
  });
  // Riskiest first, official last.
  domains.sort((x, y) => y.risk - x.risk || Number(x.level === "official") - Number(y.level === "official"));

  const contact = (kind: "phone" | "email", value: string): ContactIndicator => {
    const listed = a.ctx.blocklist.has(iocKey(kind, value));
    const campaign = a.ctx.campaignIocs.get(iocKey(kind, value)) ?? null;
    const official = kind === "phone" ? a.ctx.officialChannels.has(channelKey("phone", value)) : a.ctx.officialChannels.has(channelKey("email", value));
    return {
      value: kind === "email" ? defang(value) : value,
      level: official ? "official" : listed || campaign ? "malicious" : "no_signals",
      campaignCode: campaign?.code ?? null,
    };
  };
  return {
    domains,
    phones: [...new Set(a.phones)].slice(0, 10).map((p) => contact("phone", p)),
    emails: [...new Set(a.emails.map((e) => e.toLowerCase()))].slice(0, 10).map((e) => {
      const c = contact("email", e);
      if (c.level !== "no_signals") return c;
      // An address inherits its domain's risk: a link domain we already rated, or a lookalike.
      const host = e.split("@")[1] ?? "";
      const rated = domains.find((d) => d.value === defang(host));
      if (rated && rated.level !== "no_signals") return { ...c, level: rated.level, campaignCode: c.campaignCode ?? rated.campaignCode };
      if (host && scoreDomain(host, a.ctx).lookalike) return { ...c, level: "high" as const };
      return a.officialSenderId && e === a.senderAddress?.toLowerCase() ? { ...c, level: "official" as const } : c;
    }),
  };
}
