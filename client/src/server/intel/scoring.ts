import { flagForScore, type Thresholds } from "@/lib/flags";
import { defang } from "@/server/detection/normalize";
import { fuse } from "@/server/detection/fusion";
import { reason } from "@/server/detection/reasons";
import type { Reason } from "@/server/detection/types";
import type { ProviderResult, SubdomainRow } from "./types";

const DAY = 86_400_000;

export interface LifetimeInput {
  domain: string;
  registeredAt?: string | null;   // RDAP, then VirusTotal creation_date, then domains table
  expiresAt?: string | null;
  privacy?: boolean | null;
  firstCertAt?: string | null;
  firstReportAt?: string | null;
  riskyInfra?: boolean;
  now?: Date;
}

/** Domain lifetime scoring (Links group). Unknown age is never treated as old. */
export function lifetimeReasons(i: LifetimeInput): { reasons: Reason[]; ageDays: number | null } {
  const now = (i.now ?? new Date()).getTime();
  const shown = defang(i.domain);
  const reasons: Reason[] = [];
  const reg = i.registeredAt ? Date.parse(i.registeredAt) : NaN;
  const ageDays = Number.isNaN(reg) ? null : Math.max(0, Math.floor((now - reg) / DAY));

  if (ageDays === null) reasons.push(reason("age_unknown", 3, shown));
  else if (ageDays < 7) reasons.push(reason("domain_age", 14, String(ageDays)));
  else if (ageDays < 30) reasons.push(reason("domain_age", 10, String(ageDays)));
  else if (ageDays < 90) reasons.push(reason("domain_age", 5, String(ageDays)));

  if (!Number.isNaN(reg)) {
    const firsts = [i.firstCertAt, i.firstReportAt].map((d) => (d ? Date.parse(d) : NaN)).filter((t) => !Number.isNaN(t));
    if (firsts.some((t) => t >= reg && t - reg <= 2 * DAY)) reasons.push(reason("cert_fast", 4, shown));
  }
  if (i.riskyInfra) reasons.push(reason("infra_pattern", 3, shown));
  if (i.privacy && (ageDays === null || ageDays < 90)) reasons.push(reason("whois_privacy", 2, shown));
  if (i.expiresAt) {
    const left = Date.parse(i.expiresAt) - now;
    if (!Number.isNaN(left) && left >= 0 && left <= 30 * DAY) reasons.push(reason("expires_soon", 2, shown));
  }
  return { reasons, ageDays };
}

const KEYWORDS = ["login", "secure", "verify", "account", "pay", "gov", "e-albania", "ealbania", "signin", "update", "bank"];

/** Rank subdomain names: brand tokens and risky words first; keep at most 50. */
export function rankSubdomains(names: { name: string; source: "virustotal" | "crtsh"; firstSeen?: string }[], brandTokens: string[], max = 50) {
  const seen = new Map<string, { name: string; source: "virustotal" | "crtsh"; firstSeen?: string }>();
  for (const n of names) {
    const name = n.name.trim().toLowerCase().replace(/\.$/, "");
    if (!name || name.includes("*") || seen.has(name)) continue;
    seen.set(name, { ...n, name });
  }
  const score = (name: string) => {
    let s = 0;
    if (brandTokens.some((b) => b && name.includes(b))) s += 10;
    for (const k of KEYWORDS) if (name.includes(k)) s += 5;
    return s;
  };
  return [...seen.values()]
    .map((n) => ({ ...n, brandToken: brandTokens.some((b) => b && n.name.includes(b)), rank: score(n.name) }))
    .sort((a, b) => b.rank - a.rank || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, max);
}

/** Subdomain trick (+8) and subdomain farm (+6, five or more brand-token subdomains). */
export function subdomainReasons(registrable: string, subs: { name: string; brandToken: boolean }[], registrableIsOfficial: boolean): Reason[] {
  const shown = defang(registrable);
  const out: Reason[] = [];
  const brand = subs.filter((s) => s.brandToken && s.name !== registrable);
  if (!registrableIsOfficial && brand.length > 0) out.push(reason("subdomain_trick", 8, defang(brand[0].name)));
  if (!registrableIsOfficial && brand.length >= 5) out.push(reason("subdomain_farm", 6, shown));
  return out;
}

/** Reputation reasons and floors from provider verdicts (including subdomain verdicts). */
export function intelVerdictReasons(results: ProviderResult[], subs: Pick<SubdomainRow, "subdomain" | "verdict">[], domain: string): { reasons: Reason[]; floor: 0 | 40 | 80 } {
  const shown = defang(domain);
  const vt = results.filter((r) => r.provider === "virustotal" && r.status === "done");
  const vtMax = Math.max(0, ...vt.map((r) => r.maliciousCount ?? 0));
  const urlhausListed = results.some((r) => r.provider === "urlhaus" && r.status === "done" && r.verdict === "malicious");
  const ha = results.find((r) => r.provider === "hybrid_analysis" && r.status === "done");
  const haScore = Number((ha?.summary as { threatScore?: number } | undefined)?.threatScore ?? 0);
  const haMalicious = ha?.verdict === "malicious" || haScore >= 70;
  const subMalicious = subs.some((s) => s.verdict === "malicious");

  if (urlhausListed || vtMax >= 3 || haMalicious || subMalicious) return { reasons: [reason("intel_malicious", 10, shown)], floor: 80 };
  if (vtMax >= 1 || ha?.verdict === "suspicious" || vt.some((r) => r.verdict === "suspicious")) return { reasons: [reason("intel_suspicious", 5, shown)], floor: 40 };
  return { reasons: [], floor: 0 };
}

/**
 * Fold intelligence into the existing score. Intel reasons replace the older
 * stored-data equivalents (domain_new), group caps still apply, floors raise,
 * clean results never lower the score, and the official-sender cap is kept.
 */
export function foldIntel(input: { baseScore: number; baseReasons: Reason[]; intelReasons: Reason[]; floor: 0 | 40 | 80; thresholds: Thresholds }) {
  const { baseScore, baseReasons, intelReasons, floor, thresholds } = input;
  const capped = baseScore <= 19 && baseReasons.some((r) => r.code === "official_sender" || r.code === "official_domain");
  if (capped) return { score: baseScore, flag: flagForScore(baseScore, thresholds), delta: 0, reasons: baseReasons };
  const replaced = new Set(intelReasons.some((r) => r.code === "domain_age" || r.code === "age_unknown") ? ["domain_new"] : []);
  const byCode = new Map<string, Reason>();
  for (const r of [...baseReasons.filter((r) => !replaced.has(r.code)), ...intelReasons]) {
    const prev = byCode.get(r.code);
    if (!prev || r.weight > prev.weight) byCode.set(r.code, r);
  }
  const fused = fuse([...byCode.values()], { thresholds, floor: false, cap: false, analysed: true });
  const score = Math.min(100, Math.max(baseScore, fused.score, floor));
  return { score, flag: flagForScore(score, thresholds), delta: score - baseScore, reasons: fused.reasons };
}
