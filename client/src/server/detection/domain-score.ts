import { distance } from "fastest-levenshtein";
import { parse } from "tldts";
import type { DetectionContext } from "./context";
import { hostToUnicode, stripSynthetic } from "./normalize";

/** Confusable characters → Latin skeleton (digits, Cyrillic, Greek). */
const CONFUSABLES: Record<string, string> = {
  "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "|": "l", "!": "i",
  // Cyrillic
  "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c",
  "т": "t", "у": "y", "х": "x", "і": "i", "ї": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ɡ": "g", "ӏ": "l",
  // Greek
  "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t",
  "υ": "u", "χ": "x", "ω": "w",
};
const MULTI_CONFUSABLES: [RegExp, string][] = [
  [/rn/g, "m"],
  [/vv/g, "w"],
  [/cl/g, "d"],
];

/** Visual skeleton used to compare a label with official labels. */
export function skeleton(label: string, multi = true): string {
  let s = label.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  s = [...s].map((ch) => CONFUSABLES[ch] ?? ch).join("");
  if (multi) for (const [re, to] of MULTI_CONFUSABLES) s = s.replace(re, to);
  return s;
}

/** Words scammers add to an official name (sq/en). SPEC 6.1 combosquat. */
export const COMBO_WORDS = new Set([
  "aplikim", "aplikimi", "verify", "verifiko", "verifikim", "fines", "fine", "gjoba", "gjobe", "gov", "pagesa",
  "pagese", "pay", "payment", "secure", "sigurt", "login", "hyr", "online", "portal", "service", "sherbim",
  "update", "rimbursim", "refund", "track", "dergesa", "pako", "parcel", "support", "ndihme", "account",
  "llogari", "konfirmo", "confirm", "info", "al", "alb", "albania", "shqiperi", "web", "app",
]);

export const ODD_TLDS = new Set([
  "zip", "top", "xyz", "click", "link", "icu", "buzz", "live", "shop", "rest", "cam", "cfd", "sbs", "online",
  "site", "monster", "work", "gq", "tk", "ml", "ga", "cf", "pw", "loan", "win", "bid",
]);

export const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "ow.ly", "shorturl.at", "s.id",
  "rebrand.ly", "t.ly", "buff.ly", "tiny.cc", "v.gd",
]);

export type LookalikeClass = "typosquat" | "homoglyph" | "combosquat" | "subdomain_trick";

export interface DomainFinding {
  host: string;
  official?: { institutionId: string };
  lookalike?: { cls: LookalikeClass; imitates: string; institutionId: string };
  punycode: boolean;
  oddTld: boolean;
  shortener: boolean;
}

interface ParsedHost {
  host: string;
  unicode: string;
  /** Registrable domain including the synthetic suffix, e.g. 1ezhe-gov.al.example */
  registrable: string;
  /** Label(s) before the public suffix, e.g. "1ezhe-gov" */
  core: string;
  subdomain: string;
  tld: string;
}

export function parseHost(host: string): ParsedHost {
  const unicode = hostToUnicode(host);
  const { base, suffix } = stripSynthetic(unicode);
  const p = parse(base, { allowPrivateDomains: false });
  const core = p.domainWithoutSuffix ?? base.split(".")[0] ?? base;
  return {
    host,
    unicode,
    registrable: `${p.domain ?? base}${suffix}`,
    core,
    subdomain: p.subdomain ?? "",
    tld: p.publicSuffix?.split(".").pop() ?? "",
  };
}

const collapse = (s: string) => s.replace(/[-_.]/g, "");

/** Classify a host against official domains (SPEC 6.1 domain-score.ts). */
export function scoreDomain(host: string, ctx: DetectionContext): DomainFinding {
  const h = parseHost(host);
  const finding: DomainFinding = {
    host,
    punycode: host.split(".").some((l) => l.startsWith("xn--")),
    oddTld: ODD_TLDS.has(h.tld),
    shortener: SHORTENERS.has(stripSynthetic(host).base),
  };

  // Exact official domain or a subdomain of one.
  for (const [official, institutionId] of ctx.officialDomains) {
    if (host === official || host.endsWith(`.${official}`)) {
      finding.official = { institutionId };
      return finding;
    }
  }

  const raw = h.core.toLowerCase();
  const rawCollapsed = collapse(raw);
  const skel = skeleton(raw);
  const skelCollapsed = collapse(skel);
  const skelTokens = skel.split(/[-_.]/).filter(Boolean);
  const rawTokens = raw.split(/[-_.]/).filter(Boolean);

  let best: DomainFinding["lookalike"] & { rank: number } = undefined as never;
  const consider = (cls: LookalikeClass, imitates: string, institutionId: string) => {
    const rank = { homoglyph: 4, typosquat: 3, subdomain_trick: 2, combosquat: 1 }[cls];
    if (!best || rank > best.rank) best = { cls, imitates, institutionId, rank };
  };

  for (const [official, institutionId] of ctx.officialDomains) {
    const o = parseHost(official);
    const oCore = o.core.toLowerCase();
    const oCollapsed = collapse(oCore);
    if (oCollapsed.length < 4) continue;
    const oSkel = collapse(skeleton(oCore));

    // Subdomain trick: e-albania.al.evil.example
    const offBase = stripSynthetic(official).base;
    if (h.subdomain && (h.subdomain === offBase || h.subdomain.startsWith(`${offBase}.`) || h.subdomain.endsWith(`.${offBase}`) || h.subdomain.split(".").includes(oCore))) {
      consider("subdomain_trick", official, institutionId);
      continue;
    }

    const brandInRaw = rawCollapsed.includes(oCollapsed) || rawTokens.includes(oCore);
    const brandInSkel = skelCollapsed.includes(oSkel) || skelTokens.some((t) => collapse(t) === oSkel);

    if (!brandInRaw && brandInSkel) {
      consider("homoglyph", official, institutionId);
      continue;
    }
    if (brandInRaw && rawCollapsed !== oCollapsed) {
      const extra = rawTokens.filter((t) => collapse(t) !== oCollapsed && !oCore.split("-").includes(t));
      if (extra.length === 0 || extra.some((t) => COMBO_WORDS.has(t)) || rawCollapsed.length > oCollapsed.length) {
        consider("combosquat", official, institutionId);
        continue;
      }
    }
    if (brandInRaw && rawCollapsed === oCollapsed && h.registrable !== official) {
      // Same name under a different suffix, e.g. lezhe.al vs lezhe.gov.al
      consider("typosquat", official, institutionId);
      continue;
    }
    // Typosquat: small edit distance on the visual skeleton.
    const d = distance(skelCollapsed, oSkel);
    const maxD = oSkel.length >= 7 ? 2 : oSkel.length >= 5 ? 1 : 0;
    if (d > 0 && d <= maxD) consider("typosquat", official, institutionId);
    else if (d === 0 && raw !== oCore) consider("homoglyph", official, institutionId);
  }

  if (best) {
    const { cls, imitates, institutionId } = best;
    finding.lookalike = { cls, imitates, institutionId };
  }
  return finding;
}

/** Brand tokens of official domains, used for SAN and text checks. */
export function officialCores(ctx: DetectionContext): string[] {
  return [...ctx.officialDomains.keys()].map((d) => parseHost(d).core.toLowerCase()).filter((c) => c.length >= 4);
}
