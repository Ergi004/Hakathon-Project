/**
 * Pure phishing-pattern engine. Callers pass signals already computed by
 * scoreDomain, scoreWhois, and scoreRules. This module does not read the
 * database, does not fetch submitted URLs, and does not keep SMS or email text.
 */
import type { DomainIntel } from "./context";
import { parseHost, type DomainFinding, type LookalikeClass } from "./domain-score";
import { extractUrls, foldText, hostOf, refang } from "./normalize";
import type { RuleSignal } from "./rules";
import type { AnalysisInput } from "./types";
import type { WhoisFinding } from "./whois-score";

export type ScamType =
  | "fake_institution_login"
  | "parcel_postal_fee"
  | "fine_or_tax_refund"
  | "fake_bank"
  | "fake_app"
  | "other";

export type BrandCategory =
  | "e_albania"
  | "tax"
  | "postal"
  | "municipality"
  | "bank"
  | "police"
  | "utility"
  | "telecom"
  | "other";

export type ExfilKind = "telegram" | "webhook" | "php";

export type ThemeCode = "parcel" | "tax_refund" | "login" | "app";

export type GroupReason = "shared_exfil" | "shared_url" | "shared_domain" | "similar_text";

/** Transparent weights. Confidence is the capped sum of matched weights. No model. */
export const SIGNAL_WEIGHTS = {
  lookalike: 0.3,
  young_domain: 0.15,
  odd_tld: 0.08,
  punycode: 0.08,
  shortener: 0.06,
  urgency: 0.08,
  payment: 0.12,
  threat: 0.14,
  secrets: 0.16,
  exfil_telegram: 0.22,
  exfil_webhook: 0.22,
  exfil_php: 0.12,
  brand_mention: 0.1,
  theme_parcel: 0.12,
  theme_tax_refund: 0.12,
  theme_login: 0.1,
  theme_app: 0.18,
} as const;

export type SignalCode = keyof typeof SIGNAL_WEIGHTS;

/** Word-shingle TF-IDF cosine at or above this groups two texts. */
export const TEXT_SIMILARITY_MIN = 0.55;

const SHINGLE_SIZE = 3;
const MIN_SHARED_SHINGLES = 3;

export interface HostSignal {
  domain: DomainFinding;
  /** Null when no stored whois row was available. */
  whois: WhoisFinding | null;
  /** Null when no stored DomainIntel row was available. */
  intel: DomainIntel | null;
}

export interface PatternSignals {
  hosts: HostSignal[];
  rules: Record<RuleSignal, string | null>;
}

export interface DomainFeatures {
  host: string | null;
  tld: string | null;
  lookalikeTarget: string | null;
  lookalikeClass: LookalikeClass | null;
  official: boolean;
  /** Null when whois is missing. True only when stored age is under 30 days. */
  ageUnder30Days: boolean | null;
  oddTld: boolean;
  punycode: boolean;
  shortener: boolean;
}

export interface ContentFeatures {
  urgency: string | null;
  payment: string | null;
  threat: string | null;
  secrets: string | null;
}

export interface InfraFeatures {
  registrar: string | null;
  nameserver: string | null;
  hostingCountry: string | null;
}

export interface ExfilTarget {
  kind: ExfilKind;
  /** Refanged URL already present in the submission. Never fetched. */
  url: string;
  /** Stable endpoint identity used for campaign grouping. */
  endpoint: string;
}

export interface BrandMention {
  category: Exclude<BrandCategory, "other">;
  /** Folded token or official domain. Not the message. */
  evidence: string;
  source: "lookalike" | "text";
}

export interface ThemeHit {
  code: ThemeCode;
  evidence: string;
}

export interface ScamFeatures {
  domain: DomainFeatures;
  content: ContentFeatures;
  infrastructure: InfraFeatures;
  exfil: ExfilTarget[];
  brands: BrandMention[];
  themes: ThemeHit[];
}

export interface MatchedSignal {
  code: SignalCode;
  weight: number;
  evidence: string | null;
}

export interface ScamClassification {
  scamType: ScamType;
  impersonatedBrand: BrandCategory;
  confidence: number;
  matchedSignals: MatchedSignal[];
}

export interface GroupCandidate {
  hosts: string[];
  urls: string[];
  exfilEndpoints: string[];
  /** Masked or raw text used only to compare shingles. Not retained on features. */
  text?: string;
}

export interface CampaignGroup {
  groupKey: string;
  reason: GroupReason;
  /** Shared endpoint, URL, domain, or the TF-IDF cosine. */
  evidence: string;
}

const EMPTY_DOMAIN: DomainFeatures = {
  host: null,
  tld: null,
  lookalikeTarget: null,
  lookalikeClass: null,
  official: false,
  ageUnder30Days: null,
  oddTld: false,
  punycode: false,
  shortener: false,
};

const BRAND_LEXICON: { category: Exclude<BrandCategory, "other">; re: RegExp }[] = [
  { category: "e_albania", re: /\be-?albania\b/ },
  { category: "tax", re: /\btatime(?:t|ve)?\b|\bdrejtoria e tatimeve\b/ },
  { category: "postal", re: /\bpostashqiptare\b|\bposta\b/ },
  { category: "municipality", re: /\bbashki(?:a|se|s|ne)?\b/ },
  { category: "bank", re: /\bbank(?:a|e|es|en|ave)?\b/ },
  { category: "police", re: /\bpolici(?:a|se|ne|s)?\b/ },
  { category: "utility", re: /\boshee\b|\bukt\b/ },
  { category: "telecom", re: /\bvodafone\b|\balbtelecom\b|\btelekom(?:i|in)?\b/ },
];

const THEME_LEXICON: { code: ThemeCode; re: RegExp }[] = [
  { code: "parcel", re: /\bpako(?:n|ja|s)?\b|\bderges(?:e|a|en|es)\b|\bparcel\b|\bpackage\b|\btracking\b/ },
  { code: "tax_refund", re: /\brimburs(?:im|imi)?\b|\brefund\b|\btatim(?:e|et|i|or|eve)?\b|\bkthim i parave\b/ },
  { code: "login", re: /\blogin\b|\bhyrni\b|\bhyrje\b|\bverifik(?:o|oni|im|imi)\b|\bllogari(?:a|ne)?\b|\bpassword\b|\bfjalekalim(?:i|in)?\b/ },
  { code: "app", re: /\baplikacion(?:in|i|et)?\b|\bshkarko(?:ni)?\b|\bgoogle play\b|\bapp store\b|\bapk\b/ },
];

const STOPWORDS = new Set(["dhe", "ese", "eshte", "jane", "juaj", "juve", "keni", "nga", "nje", "nuk", "ose", "per", "qe"]);

const SCAM_PRIORITY: readonly Exclude<ScamType, "other">[] = [
  "parcel_postal_fee",
  "fine_or_tax_refund",
  "fake_bank",
  "fake_app",
  "fake_institution_login",
];

function assertNever(value: never): never {
  throw new Error(`Unexpected variant: ${String(value)}`);
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function submittedText(input: AnalysisInput): string {
  return [input.subject, input.text].filter((part): part is string => Boolean(part)).join("\n");
}

/** Lure prose without URL tokens, so a host is not treated as a brand mention. */
function proseOnly(text: string): string {
  return text
    .replace(/\b(?:https?|hxxps?):\/\/\S+/gi, " ")
    .replace(/\S*(?:\[\.\]|\(\.\)|\{\.\})\S*/g, " ");
}

function submittedUrls(input: AnalysisInput): string[] {
  if (input.kind === "phone") return [];
  const text = submittedText(input);
  const found = text ? extractUrls(text) : [];
  const given = (input.urls ?? []).map((url) => refang(url.trim())).filter(Boolean);
  return [...new Set([...given, ...found])];
}

function pathname(url: string): string {
  const value = refang(url.trim());
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`;
    return new URL(withScheme).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function isWebhook(host: string, path: string): boolean {
  if (host === "webhook.site" || host.endsWith(".webhook.site")) return true;
  if (host === "hooks.slack.com" || host.endsWith(".hooks.slack.com")) return true;
  if (host.includes("webhook")) return true;
  const discord = host === "discord.com" || host.endsWith(".discord.com") || host.endsWith(".discordapp.com");
  return discord && path.includes("/api/webhooks");
}

function classifyExfil(url: string): ExfilKind | null {
  const host = hostOf(url);
  if (!host) return null;
  const path = pathname(url);
  if (host === "t.me" || host === "telegram.me" || host === "telegram.dog") return "telegram";
  if (isWebhook(host, path)) return "webhook";
  if (path.endsWith(".php")) return "php";
  return null;
}

function endpointFor(kind: ExfilKind, url: string): string {
  const host = hostOf(url) ?? "";
  const path = pathname(url).replace(/\/+$/, "");
  switch (kind) {
    case "telegram": {
      const segment = path.split("/").filter(Boolean)[0] ?? "";
      return segment ? `t.me/${segment}` : "t.me";
    }
    case "webhook":
      return `${host}${path}`;
    case "php":
      return `${host}${path}`;
    default:
      return assertNever(kind);
  }
}

function collectExfil(urls: string[]): ExfilTarget[] {
  const out: ExfilTarget[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const kind = classifyExfil(url);
    if (!kind) continue;
    const endpoint = endpointFor(kind, url);
    if (seen.has(endpoint)) continue;
    seen.add(endpoint);
    out.push({ kind, url: refang(url), endpoint });
  }
  return out;
}

/** Map an official domain a lookalike is copying onto a brand category. */
function brandOfHost(host: string): Exclude<BrandCategory, "other"> | null {
  const folded = foldText(host);
  if (folded.includes("e-albania") || folded.includes("ealbania")) return "e_albania";
  if (folded.includes("tatime") || folded.includes("tatim")) return "tax";
  if (folded.includes("posta")) return "postal";
  if (folded.includes("polici") || folded.includes("asp.gov")) return "police";
  if (folded.includes("oshee") || /(^|[^a-z])ukt([^a-z]|$)/.test(folded)) return "utility";
  if (folded.includes("vodafone") || folded.includes("albtelecom") || folded.includes("telekom")) return "telecom";
  if (folded.includes("bank")) return "bank";
  if (folded.includes("bashki")) return "municipality";
  if (folded.includes(".gov.al")) return "municipality";
  return null;
}

function textBrands(prose: string): BrandMention[] {
  const folded = foldText(prose);
  const out: BrandMention[] = [];
  for (const entry of BRAND_LEXICON) {
    const match = folded.match(entry.re);
    if (!match) continue;
    out.push({ category: entry.category, evidence: match[0], source: "text" });
  }
  return out;
}

function lookalikeBrands(hosts: HostSignal[]): BrandMention[] {
  const out: BrandMention[] = [];
  for (const host of hosts) {
    const target = host.domain.lookalike?.imitates;
    if (!target) continue;
    const category = brandOfHost(target);
    if (!category) continue;
    out.push({ category, evidence: target, source: "lookalike" });
  }
  return out;
}

function dedupeBrands(brands: BrandMention[]): BrandMention[] {
  const byCategory = new Map<BrandMention["category"], BrandMention>();
  for (const brand of brands) {
    const prev = byCategory.get(brand.category);
    if (!prev || (brand.source === "lookalike" && prev.source !== "lookalike")) byCategory.set(brand.category, brand);
  }
  return [...byCategory.values()];
}

function textThemes(prose: string): ThemeHit[] {
  const folded = foldText(prose);
  const out: ThemeHit[] = [];
  for (const entry of THEME_LEXICON) {
    const match = folded.match(entry.re);
    if (!match) continue;
    out.push({ code: entry.code, evidence: match[0] });
  }
  return out;
}

function hostRank(host: HostSignal): number {
  return (
    (host.domain.lookalike ? 8 : 0) +
    (host.whois?.young ? 4 : 0) +
    (host.domain.oddTld ? 2 : 0) +
    (host.domain.punycode ? 1 : 0) +
    (host.domain.official ? 0 : 1)
  );
}

function primaryHost(hosts: HostSignal[]): HostSignal | null {
  if (hosts.length === 0) return null;
  let best = hosts[0];
  let bestRank = hostRank(best);
  for (const host of hosts.slice(1)) {
    const rank = hostRank(host);
    if (rank > bestRank) {
      best = host;
      bestRank = rank;
    }
  }
  return best;
}

function domainFeatures(host: HostSignal | null): DomainFeatures {
  if (!host) return EMPTY_DOMAIN;
  const parsed = parseHost(host.domain.host);
  return {
    host: host.domain.host,
    tld: parsed.tld || null,
    lookalikeTarget: host.domain.lookalike?.imitates ?? null,
    lookalikeClass: host.domain.lookalike?.cls ?? null,
    official: Boolean(host.domain.official),
    ageUnder30Days: host.whois ? host.whois.young : null,
    oddTld: host.domain.oddTld,
    punycode: host.domain.punycode,
    shortener: host.domain.shortener,
  };
}

function contentFeatures(rules: PatternSignals["rules"]): ContentFeatures {
  return {
    urgency: rules.urgency,
    payment: rules.payment_lure,
    threat: rules.threat,
    secrets: rules.asks_secrets,
  };
}

function infraFeatures(intel: DomainIntel | null | undefined): InfraFeatures {
  return {
    registrar: clean(intel?.registrar),
    nameserver: clean(intel?.nameserver),
    hostingCountry: clean(intel?.hostingCountry),
  };
}

/**
 * Features of one submission. `signals` must already be scored; missing whois
 * or DomainIntel stays null. URLs are read from the submission and never fetched.
 */
export function extractFeatures(input: AnalysisInput, signals: PatternSignals): ScamFeatures {
  const primary = primaryHost(signals.hosts);
  const prose = proseOnly(submittedText(input));
  return {
    domain: domainFeatures(primary),
    content: contentFeatures(signals.rules),
    infrastructure: infraFeatures(primary?.intel),
    exfil: collectExfil(submittedUrls(input)),
    brands: dedupeBrands([...lookalikeBrands(signals.hosts), ...textBrands(prose)]),
    themes: textThemes(prose),
  };
}

function weightOf(code: SignalCode): number {
  switch (code) {
    case "lookalike":
      return SIGNAL_WEIGHTS.lookalike;
    case "young_domain":
      return SIGNAL_WEIGHTS.young_domain;
    case "odd_tld":
      return SIGNAL_WEIGHTS.odd_tld;
    case "punycode":
      return SIGNAL_WEIGHTS.punycode;
    case "shortener":
      return SIGNAL_WEIGHTS.shortener;
    case "urgency":
      return SIGNAL_WEIGHTS.urgency;
    case "payment":
      return SIGNAL_WEIGHTS.payment;
    case "threat":
      return SIGNAL_WEIGHTS.threat;
    case "secrets":
      return SIGNAL_WEIGHTS.secrets;
    case "exfil_telegram":
      return SIGNAL_WEIGHTS.exfil_telegram;
    case "exfil_webhook":
      return SIGNAL_WEIGHTS.exfil_webhook;
    case "exfil_php":
      return SIGNAL_WEIGHTS.exfil_php;
    case "brand_mention":
      return SIGNAL_WEIGHTS.brand_mention;
    case "theme_parcel":
      return SIGNAL_WEIGHTS.theme_parcel;
    case "theme_tax_refund":
      return SIGNAL_WEIGHTS.theme_tax_refund;
    case "theme_login":
      return SIGNAL_WEIGHTS.theme_login;
    case "theme_app":
      return SIGNAL_WEIGHTS.theme_app;
    default:
      return assertNever(code);
  }
}

function pushSignal(list: MatchedSignal[], code: SignalCode, evidence: string | null) {
  list.push({ code, weight: weightOf(code), evidence });
}

function matchedSignals(features: ScamFeatures): MatchedSignal[] {
  const out: MatchedSignal[] = [];
  const domain = features.domain;
  const suspiciousHost = !domain.official || domain.lookalikeTarget !== null;
  if (suspiciousHost && domain.lookalikeTarget && domain.lookalikeClass) {
    pushSignal(out, "lookalike", `${domain.lookalikeClass}:${domain.lookalikeTarget}`);
  }
  if (suspiciousHost && domain.ageUnder30Days === true && domain.host) pushSignal(out, "young_domain", domain.host);
  if (suspiciousHost && domain.oddTld && domain.tld) pushSignal(out, "odd_tld", domain.tld);
  if (suspiciousHost && domain.punycode && domain.lookalikeClass && domain.host) pushSignal(out, "punycode", domain.host);
  if (suspiciousHost && domain.shortener && domain.host) pushSignal(out, "shortener", domain.host);
  if (features.content.urgency) pushSignal(out, "urgency", features.content.urgency);
  if (features.content.payment) pushSignal(out, "payment", features.content.payment);
  if (features.content.threat) pushSignal(out, "threat", features.content.threat);
  if (features.content.secrets) pushSignal(out, "secrets", features.content.secrets);
  for (const theme of features.themes) pushSignal(out, themeCode(theme.code), theme.evidence);
  for (const brand of features.brands) pushSignal(out, "brand_mention", `${brand.category}:${brand.evidence}`);
  for (const target of features.exfil) pushSignal(out, exfilCode(target.kind), target.endpoint);
  return out;
}

function themeCode(code: ThemeCode): SignalCode {
  switch (code) {
    case "parcel":
      return "theme_parcel";
    case "tax_refund":
      return "theme_tax_refund";
    case "login":
      return "theme_login";
    case "app":
      return "theme_app";
    default:
      return assertNever(code);
  }
}

function exfilCode(kind: ExfilKind): SignalCode {
  switch (kind) {
    case "telegram":
      return "exfil_telegram";
    case "webhook":
      return "exfil_webhook";
    case "php":
      return "exfil_php";
    default:
      return assertNever(kind);
  }
}

function hasBrand(features: ScamFeatures, category: Exclude<BrandCategory, "other">): boolean {
  return features.brands.some((brand) => brand.category === category);
}

function hasTheme(features: ScamFeatures, code: ThemeCode): boolean {
  return features.themes.some((theme) => theme.code === code);
}

function hasLure(features: ScamFeatures): boolean {
  return Boolean(
    features.content.payment ||
      features.content.urgency ||
      features.content.secrets ||
      features.content.threat ||
      features.exfil.length ||
      features.domain.lookalikeTarget ||
      features.domain.ageUnder30Days === true ||
      features.domain.oddTld,
  );
}

function gateOpen(type: ScamType, features: ScamFeatures): boolean {
  switch (type) {
    case "parcel_postal_fee":
      return (hasTheme(features, "parcel") || hasBrand(features, "postal")) && hasLure(features);
    case "fine_or_tax_refund":
      return (Boolean(features.content.threat) || hasTheme(features, "tax_refund") || hasBrand(features, "tax")) && hasLure(features);
    case "fake_bank":
      return hasBrand(features, "bank") && (hasLure(features) || hasTheme(features, "login"));
    case "fake_app":
      return hasTheme(features, "app") && (hasLure(features) || hasTheme(features, "login"));
    case "fake_institution_login":
      return (
        (Boolean(features.content.secrets) || hasTheme(features, "login")) &&
        (hasBrand(features, "e_albania") ||
          hasBrand(features, "tax") ||
          hasBrand(features, "municipality") ||
          hasBrand(features, "utility") ||
          hasBrand(features, "police") ||
          hasBrand(features, "telecom") ||
          brandFits("fake_institution_login", lookalikeCategory(features)))
      );
    case "other":
      return false;
    default:
      return assertNever(type);
  }
}

function lookalikeCategory(features: ScamFeatures): BrandCategory | null {
  return features.brands.find((brand) => brand.source === "lookalike")?.category ?? null;
}

function brandFits(type: ScamType, category: BrandCategory | null): boolean {
  if (!category || category === "other") return false;
  switch (type) {
    case "parcel_postal_fee":
      return category === "postal";
    case "fine_or_tax_refund":
      return category === "municipality" || category === "tax" || category === "police" || category === "e_albania";
    case "fake_bank":
      return category === "bank";
    case "fake_app":
      return false;
    case "fake_institution_login":
      return (
        category === "e_albania" ||
        category === "tax" ||
        category === "municipality" ||
        category === "utility" ||
        category === "police" ||
        category === "telecom"
      );
    case "other":
      return false;
    default:
      return assertNever(type);
  }
}

function signalSupports(type: ScamType, signal: MatchedSignal, features: ScamFeatures): boolean {
  switch (signal.code) {
    case "young_domain":
    case "odd_tld":
    case "punycode":
    case "shortener":
    case "urgency":
    case "payment":
    case "secrets":
    case "exfil_telegram":
    case "exfil_webhook":
    case "exfil_php":
      return true;
    case "threat":
      return type === "fine_or_tax_refund";
    case "theme_parcel":
      return type === "parcel_postal_fee";
    case "theme_tax_refund":
      return type === "fine_or_tax_refund";
    case "theme_login":
      return type === "fake_bank" || type === "fake_institution_login";
    case "theme_app":
      return type === "fake_app";
    case "lookalike":
      return brandFits(type, lookalikeCategory(features));
    case "brand_mention":
      return brandFits(type, brandCategoryFromEvidence(signal.evidence));
    default:
      return assertNever(signal.code);
  }
}

function brandCategoryFromEvidence(evidence: string | null): BrandCategory | null {
  const category = evidence?.split(":")[0];
  switch (category) {
    case "e_albania":
    case "tax":
    case "postal":
    case "municipality":
    case "bank":
    case "police":
    case "utility":
    case "telecom":
    case "other":
      return category;
    default:
      return null;
  }
}

function scoreType(type: ScamType, features: ScamFeatures, matched: MatchedSignal[]): number {
  if (!gateOpen(type, features)) return 0;
  return matched.filter((signal) => signalSupports(type, signal, features)).reduce((sum, signal) => sum + signal.weight, 0);
}

function preferredBrand(type: ScamType, features: ScamFeatures): BrandCategory {
  const lookalike = lookalikeCategory(features);
  if (lookalike && (type === "other" || brandFits(type, lookalike))) return lookalike;
  const mentioned = features.brands.find((brand) => brandFits(type, brand.category));
  if (mentioned) return mentioned.category;
  if (lookalike) return lookalike;
  return features.brands[0]?.category ?? "other";
}

function round2(value: number): number {
  return Math.round(Math.min(1, value) * 100) / 100;
}

/** Weighted rules. Every result lists the signals that fired. */
export function classifyScam(features: ScamFeatures): ScamClassification {
  const matched = matchedSignals(features);
  let scamType: ScamType = "other";
  let best = 0;
  for (const type of SCAM_PRIORITY) {
    const score = scoreType(type, features, matched);
    if (score > best) {
      scamType = type;
      best = score;
    }
  }
  const confidence = round2(matched.reduce((sum, signal) => sum + signal.weight, 0));
  return {
    scamType,
    impersonatedBrand: preferredBrand(scamType, features),
    confidence,
    matchedSignals: matched,
  };
}

function normToken(value: string): string {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

function overlap(left: string[], right: string[]): string[] {
  const have = new Set(right);
  return [...new Set(left.filter((value) => have.has(value)))].sort();
}

function endpointsOf(item: GroupCandidate): string[] {
  const fromFields = item.exfilEndpoints.map(normToken).filter(Boolean);
  const fromUrls: string[] = [];
  for (const url of item.urls) {
    const kind = classifyExfil(url);
    if (!kind) continue;
    fromUrls.push(normToken(endpointFor(kind, url)));
  }
  return [...new Set([...fromFields, ...fromUrls])];
}

function urlKeys(item: GroupCandidate): string[] {
  const keys: string[] = [];
  for (const url of item.urls) {
    const host = hostOf(url);
    if (!host) continue;
    const path = pathname(url).replace(/\/+$/, "");
    if (!path || path === "/") continue;
    keys.push(`${host}${path}`);
  }
  return [...new Set(keys)];
}

function hostsOf(item: GroupCandidate): string[] {
  const hosts: string[] = [];
  for (const value of [...item.hosts, ...item.urls]) {
    const host = hostOf(value);
    if (host) hosts.push(host);
  }
  return [...new Set(hosts)];
}

function tokensOf(text: string): string[] {
  return foldText(proseOnly(text))
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

function shinglesOf(words: string[]): string[] {
  if (words.length === 0) return [];
  if (words.length < SHINGLE_SIZE) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i <= words.length - SHINGLE_SIZE; i++) out.push(words.slice(i, i + SHINGLE_SIZE).join(" "));
  return out;
}

function termFreq(shingles: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const shingle of shingles) freq.set(shingle, (freq.get(shingle) ?? 0) + 1);
  return freq;
}

/** Smoothed IDF over the two texts being compared. */
function pairwiseIdf(left: Map<string, number>, right: Map<string, number>): Map<string, number> {
  const idf = new Map<string, number>();
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    const df = (left.has(key) ? 1 : 0) + (right.has(key) ? 1 : 0);
    idf.set(key, Math.log((1 + 2) / (1 + df)) + 1);
  }
  return idf;
}

function cosine(left: Map<string, number>, right: Map<string, number>, idf: Map<string, number>): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    const weight = idf.get(key) ?? 0;
    const a = (left.get(key) ?? 0) * weight;
    const b = (right.get(key) ?? 0) * weight;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function textGroup(a: string | undefined, b: string | undefined): { key: string; evidence: string } | null {
  if (!a?.trim() || !b?.trim()) return null;
  const leftShingles = shinglesOf(tokensOf(a));
  const rightShingles = shinglesOf(tokensOf(b));
  const left = termFreq(leftShingles);
  const right = termFreq(rightShingles);
  const shared = overlap([...left.keys()], [...right.keys()]);
  if (shared.length < MIN_SHARED_SHINGLES) return null;
  const score = cosine(left, right, pairwiseIdf(left, right));
  if (score < TEXT_SIMILARITY_MIN) return null;
  return { key: fnv1a(shared.join("\n")), evidence: score.toFixed(2) };
}

function groupPrefix(reason: GroupReason): string {
  switch (reason) {
    case "shared_exfil":
      return "exfil";
    case "shared_url":
      return "url";
    case "shared_domain":
      return "domain";
    case "similar_text":
      return "text";
    default:
      return assertNever(reason);
  }
}

/**
 * Why two checks belong in one campaign, if they do.
 * Priority: shared exfil endpoint, shared URL, shared domain, then shingle TF-IDF.
 * Does not touch assignCampaign or the database.
 */
export function groupCandidates(a: GroupCandidate, b: GroupCandidate): CampaignGroup | null {
  const exfil = overlap(endpointsOf(a), endpointsOf(b));
  if (exfil[0]) return { groupKey: `${groupPrefix("shared_exfil")}:${exfil[0]}`, reason: "shared_exfil", evidence: exfil[0] };
  const urls = overlap(urlKeys(a), urlKeys(b));
  if (urls[0]) return { groupKey: `${groupPrefix("shared_url")}:${urls[0]}`, reason: "shared_url", evidence: urls[0] };
  const hosts = overlap(hostsOf(a), hostsOf(b));
  if (hosts[0]) return { groupKey: `${groupPrefix("shared_domain")}:${hosts[0]}`, reason: "shared_domain", evidence: hosts[0] };
  const text = textGroup(a.text, b.text);
  if (text) return { groupKey: `${groupPrefix("similar_text")}:${text.key}`, reason: "similar_text", evidence: text.evidence };
  return null;
}
