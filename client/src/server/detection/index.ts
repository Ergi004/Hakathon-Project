import { hashInput } from "@/server/hash";
import { isConfirmed, matchByIoc } from "./campaigns";
import { buildIndicators } from "./indicators";
import { channelKey, iocKey, type BlocklistHit, type CampaignRef, type DetectionContext, type IocKind } from "./context";
import { scoreAttachments } from "./attachments";
import { parseHost, scoreDomain, type LookalikeClass } from "./domain-score";
import { fuse } from "./fusion";
import { defang, extractEmails, extractPhones, extractUrls, foldText, hostOf, normalizePhone, normalizeText, parseSender } from "./normalize";
import type { GeminiClue, GeminiReview } from "./gemini-review";
import { classifyScam, extractFeatures, type BrandCategory, type HostSignal } from "./pattern";
import { REASONS, reason, type ReasonCode } from "./reasons";
import { SCORING } from "./scoring/config";
import { asksToCall, lateInterest, matchSecrets, scoreRules, type RuleSignal } from "./rules";
import { claimedInstitution, evaluateDmarc, scoreSender } from "./sender";
import { classify, type TextModel } from "./text-model";
import type { AnalysisInput, AnalysisResult, AppliedOverride, Reason, SignalAssessment, SignalState, Verdict } from "./types";
import { scoreWhois } from "./whois-score";

export type { AnalysisInput, AnalysisResult, Reason, SignalAssessment, SignalState, Verdict } from "./types";
export { createContext, type ContextData, type DetectionContext } from "./context";

/** Points from SPEC 6.3. */
export const POINTS = {
  lookalike: { typosquat: 20, homoglyph: 25, combosquat: 18, subdomain_trick: 20 } satisfies Record<LookalikeClass, number>,
  punycode: 8,
  /** Under 30 days, and not also an institution claim. */
  domainNew: 10,
  /** Under 7 days. */
  domainVeryNew: 15,
  oddTld: 5,
  shortener: 6,
  /** Email or HTML only: the visible link text is not the real destination. */
  linkMismatch: 15,
  /** The message names an institution and the link is not that institution's domain. Same weight as a combosquat. */
  impersonatedLink: 18,
  /** Lookalike or impersonated link that the message uses for a payment, a threat, or a credential ask. */
  lureDestination: 20,
  qrUnknown: 10,
  certFast: 3,
  certBrand: 4,
  /** WHOIS privacy is the default, so it no longer adds points. */
  whoisPrivacy: 0,
  infraPattern: 3,
  classifierMax: 15,
  /** Gemini is one content signal, same ceiling as the text classifier. */
  geminiMax: 15,
  urgency: 5,
  paymentLure: 6,
  threat: 5,
  /** Login or identity wording that is not a PIN, password, or card. */
  asksSecrets: 8,
  /** The message asks for a PIN, password, card, or for the recipient to send a code. */
  asksCredentials: 18,
  displaySpoof: 10,
  replyTo: 6,
  freemailInstitution: 10,
  unknownSmsSender: 12,
  /** SMS names an institution and the link is not theirs, with no official sender. */
  unofficialClaim: 25,
  attachmentExec: 15,
  attachmentArchive: 6,
  attachmentDoubleExt: 8,
  knownBad: 10,
  confirmedCampaign: 10,
  /** The text closely matches messages of a confirmed campaign (trigram similarity ≥ PATTERN.signal). */
  campaignPattern: 8,
  manyReports: 6,
} as const;

/** Text-pattern campaign matching (pg_trgm similarity of masked bodies). */
export const PATTERN = {
  /** Shown to the citizen as "matches the pattern of campaign X". */
  show: 0.5,
  /** Also adds the campaign_pattern reason when the campaign is confirmed. */
  signal: 0.6,
} as const;

export interface PatternMatch {
  id: string;
  code: string;
  status: CampaignRef["status"];
  similarity: number;
}

const LOOKALIKE_CODE: Record<LookalikeClass, ReasonCode> = {
  typosquat: "lookalike_typosquat",
  homoglyph: "lookalike_homoglyph",
  combosquat: "lookalike_combosquat",
  subdomain_trick: "subdomain_trick",
};

export interface AnalyzeOptions {
  /** Inject a trained model (tests); defaults to models/message-clf-v1.json or the lexicon. */
  model?: TextModel | null;
  now?: Date;
  /**
   * Optional Gemini read of the message. Missing key, timeout, or bad JSON
   * yields null and changes nothing. The model cannot clear a finding.
   */
  gemini?: (text: string, hosts: string[]) => Promise<GeminiReview | null>;
  /**
   * Optional text-pattern lookup against campaign messages. Runs in parallel with the rest of
   * the analysis; a failure or timeout yields null and changes nothing.
   */
  patternMatch?: (text: string) => Promise<PatternMatch | null>;
}

/** Keep the strongest reason per code. */
function addReason(list: Map<string, Reason>, r: Reason) {
  const prev = list.get(r.code);
  if (!prev || r.weight > prev.weight) list.set(r.code, r);
}

const EMPTY_RULES: Record<RuleSignal, string | null> = {
  urgency: null,
  payment_lure: null,
  threat: null,
  asks_secrets: null,
};

const GENERIC_PLACE = new Set(["bashkia", "bashki", "bashkise", "bashkine", "bashkis", "qarku", "qark", "komuna", "komune"]);

/** Under 7 days is 15, under 30 is 10. An institution claim multiplies that by 1.5. */
function domainAgeWeight(ageDays: number, institutionClaim: boolean): number {
  const base = ageDays < 7 ? POINTS.domainVeryNew : POINTS.domainNew;
  return institutionClaim ? Math.round(base * 1.5) : base;
}

function brandNeedle(brand: BrandCategory): string | null {
  switch (brand) {
    case "e_albania":
      return "e-albania";
    case "postal":
      return "posta";
    case "bank":
      return "bank";
    case "municipality":
      return "bashki";
    case "tax":
      return "tatim";
    case "police":
      return "polic";
    case "utility":
      return "oshee";
    case "telecom":
      return "telekom";
    case "other":
      return null;
    default: {
      const unexpected: never = brand;
      return unexpected;
    }
  }
}

function institutionForBrand(brand: BrandCategory, ctx: DetectionContext): { id: string; name: string } | undefined {
  const needle = brandNeedle(brand);
  if (!needle) return undefined;
  for (const [id, inst] of ctx.institutions) {
    if (inst.folded.some((name) => name.includes(needle))) return { id, name: inst.name };
  }
  return undefined;
}

/** Institution names are read from the wording, not from the link itself. */
function proseWithoutUrls(text: string): string {
  return text.replace(/\b(?:https?|hxxps?):\/\/\S+/gi, " ").replace(/\S*(?:\[\.\]|\(\.\)|\{\.\})\S*/g, " ");
}

/** Municipality or institution region named in the lure. The stored value is the directory name, not the message. */
function placeNamedInLure(input: AnalysisInput, ctx: DetectionContext): string | null {
  if (input.kind === "phone") return null;
  const raw = [input.subject, input.text].filter((part): part is string => Boolean(part)).join("\n");
  if (!raw.trim()) return null;
  const prose = foldText(
    raw.replace(/\b(?:https?|hxxps?):\/\/\S+/gi, " ").replace(/\S*(?:\[\.\]|\(\.\)|\{\.\})\S*/g, " "),
  );
  let best: { name: string; length: number } | null = null;
  for (const inst of ctx.institutions.values()) {
    const nameFold = foldText(inst.name);
    if (!nameFold.includes("bashki") && !nameFold.includes("qark") && !nameFold.includes("komun")) continue;
    for (const folded of inst.folded) {
      if (GENERIC_PLACE.has(folded)) continue;
      const pattern = new RegExp(`(?:^|[^a-z0-9])${folded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`);
      if (!pattern.test(prose)) continue;
      if (!best || folded.length > best.length) best = { name: inst.name, length: folded.length };
    }
  }
  return best?.name ?? null;
}

const SENDER_SIGNALS = ["unknown_sms_sender", "unofficial_claim"] as const;
const AGE_SIGNALS = ["domain_new", "cert_fast", "cert_brand", "whois_privacy", "infra_pattern"] as const;

function signalState(code: string, fired: ReadonlySet<string>, unavailable: ReadonlySet<string>): SignalState {
  if (unavailable.has(code)) return "unavailable";
  if (fired.has(code)) return "fired";
  return "not_fired";
}

/** Unavailable inputs reduce confidence. Missing data never adds to the score. */
function hasSafetyEvidence(fired: ReadonlySet<string>, headers: AnalysisInput["headers"]): boolean {
  if (fired.has("official_domain") || fired.has("official_sender")) return true;
  return evaluateDmarc(headers) === "pass";
}

function dayAge(iso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
}

function listingIsStale(entry: BlocklistHit, now: Date): boolean {
  const limit = SCORING.blocklist.staleAfterDays;
  if (entry.confirmedAt && Number.isFinite(Date.parse(entry.confirmedAt)) && dayAge(entry.confirmedAt, now) <= limit) return false;
  if (!entry.addedAt || !Number.isFinite(Date.parse(entry.addedAt))) return false;
  return dayAge(entry.addedAt, now) > limit;
}

function fillSource(template: string, source: string): string {
  return template.replace("{source}", source);
}

function listingOverrides(listings: readonly BlocklistHit[], now: Date): { overrides: AppliedOverride[]; label: "confirmed_scam" | "known_malicious" | null } {
  const freshVerified = listings.filter((entry) => entry.verified && !listingIsStale(entry, now));
  const freshUnverified = listings.filter((entry) => !entry.verified && !listingIsStale(entry, now));
  const stale = listings.filter((entry) => listingIsStale(entry, now));
  const overrides: AppliedOverride[] = [];
  const sources = (entries: readonly BlocklistHit[]) => [...new Set(entries.map((entry) => entry.source))].join(", ");
  if (freshVerified.length > 0) {
    overrides.push({ id: "blocklist", floor: SCORING.blocklist.floor, reason: SCORING.blocklist.labels.confirmed });
  }
  if (freshUnverified.length > 0) {
    overrides.push({
      id: "blocklist",
      floor: SCORING.blocklist.floor,
      reason: fillSource(SCORING.blocklist.labels.knownMalicious, sources(freshUnverified)),
    });
  }
  if (stale.length > 0) {
    overrides.push({
      id: "blocklist_stale",
      floor: SCORING.blocklist.staleFloor,
      reason: `${fillSource(SCORING.blocklist.labels.knownMalicious, sources(stale))}. ${SCORING.blocklist.labels.staleNote}`,
    });
  }
  const label = freshVerified.length > 0 ? "confirmed_scam" : freshUnverified.length > 0 ? "known_malicious" : null;
  return { overrides, label };
}

function verdictFor(
  flag: AnalysisResult["flag"],
  fired: ReadonlySet<string>,
  confidence: number,
  headers: AnalysisInput["headers"],
  listing: "confirmed_scam" | "known_malicious" | null,
): Verdict {
  switch (flag) {
    case "grey":
      return "not_analysed";
    case "green":
      return hasSafetyEvidence(fired, headers) && confidence >= SCORING.verdicts.safeMinConfidence
        ? "safe"
        : "no_strong_signals";
    case "yellow":
      return "careful";
    case "orange":
      return "suspicious";
    case "red":
      return "likely_scam";
    case "darkred":
      switch (listing) {
        case "confirmed_scam":
          return "confirmed_scam";
        case "known_malicious":
          return "known_malicious";
        case null:
          return "high";
        default: {
          const unexpected: never = listing;
          return unexpected;
        }
      }
    default: {
      const unexpected: never = flag;
      return unexpected;
    }
  }
}

function configuredWeight(code: string): number {
  return SCORING.signals.find((item) => item.code === code)?.weight ?? 0;
}

function scoreConfidence(applied: number[]): number {
  const raw = applied.reduce((sum, penalty) => sum - penalty, SCORING.confidence.start);
  return Math.max(SCORING.confidence.floor, Math.round(raw * 100) / 100);
}

/**
 * Analyse a link, message, phone number or email (SPEC 6). Pure: all data comes
 * from `ctx`; no network calls and no user URL is ever fetched.
 */
export async function analyze(
  input: AnalysisInput,
  ctx: DetectionContext,
  opts: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const reasons = new Map<string, Reason>();
  const text = normalizeText([input.subject, input.text].filter(Boolean).join("\n"));
  // Started now, awaited before fusion, so the database round trip overlaps the local scoring.
  const patternPending: Promise<PatternMatch | null> =
    opts.patternMatch && text && input.kind !== "phone" ? opts.patternMatch(text).catch(() => null) : Promise.resolve(null);
  let floor = false;
  let cap = false;
  const listings: BlocklistHit[] = [];
  let institutionId: string | undefined;

  // ---- Indicators -----------------------------------------------------------------
  const hrefs = (input.urls ?? []).map((u) => u.trim()).filter(Boolean);
  const textUrls = input.kind === "phone" ? [] : extractUrls(text);
  const allUrls = [...new Set([...hrefs, ...textUrls])];
  const hosts = [...new Set(allUrls.map(hostOf).filter((h): h is string => !!h))];

  const phone =
    input.kind === "phone" && input.text ? normalizePhone(input.text) : undefined;
  const senderParts = input.sender ? parseSender(input.sender) : null;

  const iocList: { kind: IocKind; value: string }[] = [
    ...hosts.map((h) => ({ kind: "domain" as const, value: h })),
    ...allUrls.map((u) => ({ kind: "url" as const, value: u })),
    ...(phone ? [{ kind: "phone" as const, value: phone }] : []),
    ...(senderParts?.address ? [{ kind: "email" as const, value: senderParts.address }] : []),
    ...(input.sender && !senderParts?.address ? [{ kind: "sender" as const, value: input.sender }] : []),
  ];

  const namedInstitution =
    text && input.kind !== "phone" ? claimedInstitution(proseWithoutUrls(text), ctx) : undefined;

  // ---- Links ----------------------------------------------------------------------
  const officialHosts = new Set<string>();
  const hostSignals: HostSignal[] = [];
  let ageUnavailable = false;
  for (const host of hosts) {
    const d = scoreDomain(host, ctx);
    const w = scoreWhois(host, ctx, opts.now);
    const intel = ctx.domainIntel.get(host) ?? ctx.domainIntel.get(parseHost(host).registrable) ?? null;
    if (!d.official && !w) ageUnavailable = true;
    hostSignals.push({ domain: d, whois: w, intel });
    const shown = defang(host);
    if (d.official) {
      officialHosts.add(host);
      institutionId ??= d.official.institutionId;
      continue;
    }
    if (d.lookalike) {
      addReason(reasons, reason(LOOKALIKE_CODE[d.lookalike.cls], POINTS.lookalike[d.lookalike.cls], shown));
      institutionId ??= d.lookalike.institutionId;
    }
    if (d.punycode && d.lookalike) addReason(reasons, reason("punycode", POINTS.punycode, shown));
    if (d.oddTld) addReason(reasons, reason("odd_tld", POINTS.oddTld, shown));
    if (d.shortener) addReason(reasons, reason("shortener", POINTS.shortener, shown));
    if (input.kind === "qr" || input.channel === "qr") addReason(reasons, reason("qr_unknown", POINTS.qrUnknown, shown));

    if (w && w.ageDays !== null && w.ageDays >= 0 && w.ageDays < 30) {
      const claimed = Boolean(d.lookalike || namedInstitution);
      addReason(reasons, reason("domain_new", domainAgeWeight(w.ageDays, claimed), shown));
    }
    if (w?.certFast) addReason(reasons, reason("cert_fast", POINTS.certFast, shown));
    if (w?.certBrand) addReason(reasons, reason("cert_brand", POINTS.certBrand, shown));
    if (w?.riskyInfra) addReason(reasons, reason("infra_pattern", POINTS.infraPattern, shown));
  }

  // Visible text names an official domain while the href goes elsewhere. SMS has no separate href.
  const emailLike = input.channel === "email" || input.kind === "email_signals";
  if (emailLike && hrefs.length && textUrls.some((u) => officialHosts.has(hostOf(u) ?? ""))) {
    const off = hrefs.map(hostOf).find((h) => h && !officialHosts.has(h));
    if (off) addReason(reasons, reason("link_mismatch", POINTS.linkMismatch, defang(off)));
  }

  // ---- Content --------------------------------------------------------------------
  const model = classify(input.kind === "phone" ? "" : text, opts.model, {
    channel: input.channel,
    urls: input.kind === "phone" ? [] : allUrls,
  });
  const rules = text && input.kind !== "phone" ? scoreRules(text) : EMPTY_RULES;
  if (text && input.kind !== "phone") {
    const pts = Math.round(model.probability * POINTS.classifierMax * 10) / 10;
    if (model.probability >= 0.5) addReason(reasons, reason("classifier", pts));
    if (rules.urgency) addReason(reasons, reason("urgency", POINTS.urgency, rules.urgency));
    if (rules.payment_lure) addReason(reasons, reason("payment_lure", POINTS.paymentLure, rules.payment_lure));
    if (rules.threat) addReason(reasons, reason("threat", POINTS.threat, rules.threat));
    const interest = lateInterest(text, rules);
    if (interest) addReason(reasons, reason("late_interest", configuredWeight("late_interest"), interest));
    if (rules.asks_secrets) {
      const matched = matchSecrets(text);
      const tier = matched?.tier ?? "account";
      addReason(reasons, reason("asks_secrets", tier === "credential" ? POINTS.asksCredentials : POINTS.asksSecrets, rules.asks_secrets));
      if (tier === "credential") addReason(reasons, reason("credential_ask", configuredWeight("credential_ask"), matched?.evidence));
    }
    if (asksToCall(text)) {
      const unofficial = extractPhones(text).find((phone) => !ctx.officialChannels.has(channelKey("phone", phone)));
      if (unofficial) addReason(reasons, reason("unofficial_callback", configuredWeight("unofficial_callback"), unofficial));
    }
  }

  const extractedEarly = extractFeatures(input, { hosts: hostSignals, rules });
  let classification = classifyScam(extractedEarly);
  const namedId = namedInstitution;
  const lure = Boolean(rules.payment_lure || rules.threat || rules.asks_secrets);
  const foreignHost = hosts.find((host) => {
    if (officialHosts.has(host)) return false;
    const signal = hostSignals.find((item) => item.domain.host === host);
    return !signal?.domain.lookalike;
  });
  if (namedId && lure && foreignHost) {
    const name = ctx.institutions.get(namedId)?.name ?? foreignHost;
    addReason(reasons, reason("impersonated_link", POINTS.impersonatedLink, `${name} (${defang(foreignHost)})`));
    institutionId ??= namedId;
  }
  const addLureDestination = () => {
    const imitates = [...reasons.values()].some(
      (item) => item.code.startsWith("lookalike_") || item.code === "subdomain_trick" || item.code === "impersonated_link",
    );
    const hasLure = reasons.has("payment_lure") || reasons.has("threat") || reasons.has("asks_secrets");
    const destination = hosts.find((host) => !officialHosts.has(host));
    if (imitates && hasLure && destination) addReason(reasons, reason("lure_destination", POINTS.lureDestination, defang(destination)));
  };
  addLureDestination();

  // ---- Sender ---------------------------------------------------------------------
  const s = scoreSender(input, ctx);
  const instName = (id?: string) => (id ? ctx.institutions.get(id)?.name : undefined);
  if (s.dmarcFail) addReason(reasons, reason("auth_fail", SCORING.emailAuth.dmarcFail, "DMARC"));
  if (s.institutionSpoof) {
    const policy = s.institutionSpoof;
    let weight: number;
    switch (policy) {
      case "reject":
        weight = SCORING.emailAuth.spoof.reject;
        break;
      case "quarantine":
        weight = SCORING.emailAuth.spoof.quarantine;
        break;
      default: {
        const unexpected: never = policy;
        weight = unexpected;
      }
    }
    addReason(reasons, reason("institution_domain_spoof", weight, `${defang(s.spoofDomain ?? "")} (${policy})`.trim()));
  }
  if (s.displaySpoof) addReason(reasons, reason("display_spoof", POINTS.displaySpoof, instName(s.claimedInstitutionId)));
  if (s.replyToMismatch) addReason(reasons, reason("reply_to_mismatch", POINTS.replyTo, defang(s.replyToMismatch)));
  if (s.freemailInstitution) addReason(reasons, reason("freemail_institution", POINTS.freemailInstitution, instName(s.claimedInstitutionId)));
  if (s.unknownSmsSender) addReason(reasons, reason("unknown_sms_sender", POINTS.unknownSmsSender, instName(s.claimedInstitutionId)));
  if (s.officialInstitutionId) {
    addReason(reasons, reason("official_sender", 0, instName(s.officialInstitutionId)));
    cap = s.capEligible;
  }
  if (!cap && input.channel === "sms" && namedId && input.sender?.trim() && reasons.has("impersonated_link")) {
    addReason(reasons, reason("unofficial_claim", POINTS.unofficialClaim, instName(namedId)));
  }
  institutionId ??= s.claimedInstitutionId ?? s.officialInstitutionId;

  // Phone input that is an official number.
  if (phone) {
    const officialPhone = ctx.officialChannels.get(channelKey("phone", phone));
    if (officialPhone) {
      addReason(reasons, reason("official_sender", 0, instName(officialPhone)));
      institutionId ??= officialPhone;
      cap = true;
    }
  }
  if (officialHosts.size && hosts.length === officialHosts.size && !hrefs.some((h) => !officialHosts.has(hostOf(h) ?? ""))) {
    for (const h of officialHosts) addReason(reasons, reason("official_domain", 0, defang(h)));
  }

  // ---- Attachments (email only; an SMS does not carry a file) --------------------
  if (emailLike) {
    const a = scoreAttachments(input.attachments);
    if (a.exec) addReason(reasons, reason("attachment_exec", POINTS.attachmentExec, a.exec));
    if (a.doubleExt) addReason(reasons, reason("attachment_double_ext", POINTS.attachmentDoubleExt, a.doubleExt));
    if (a.archive) addReason(reasons, reason("attachment_archive", POINTS.attachmentArchive, a.archive));
  }

  // ---- Reputation -----------------------------------------------------------------
  for (const i of iocList) {
    const key = iocKey(i.kind, i.value);
    const shown = i.kind === "domain" || i.kind === "url" ? defang(i.value) : i.value;
    const listed = ctx.blocklist.get(key);
    if (listed) {
      addReason(reasons, reason("known_bad", POINTS.knownBad, shown));
      listings.push(listed);
    } else if (
      (i.kind === "domain" && ctx.knownHashes.has(hashInput("domain", i.value))) ||
      (i.kind === "url" && ctx.knownHashes.has(hashInput("url", i.value))) ||
      (i.kind === "phone" && ctx.knownHashes.has(hashInput("phone", i.value)))
    ) {
      addReason(reasons, reason("known_bad", POINTS.knownBad, shown));
    }
    const camp = ctx.campaignIocs.get(key);
    if (camp && isConfirmed(camp)) {
      addReason(reasons, reason("confirmed_campaign", POINTS.confirmedCampaign, shown));
      floor = true;
    }
    const reporters = ctx.recentReporters.get(key) ?? 0;
    if (reporters >= 3) addReason(reasons, reason("many_reports", POINTS.manyReports, shown));
  }

  // ---- Gemini (one signal; never clears a finding, never the only verdict) --------
  let modelVersion = model.version;
  const addGeminiClue = (clue: GeminiClue, review: GeminiReview) => {
    switch (clue) {
      case "payment":
        if (!reasons.has("payment_lure")) addReason(reasons, reason("payment_lure", POINTS.paymentLure));
        return;
      case "threat":
        if (!reasons.has("threat")) addReason(reasons, reason("threat", POINTS.threat));
        return;
      case "secrets":
        if (!reasons.has("asks_secrets")) addReason(reasons, reason("asks_secrets", POINTS.asksSecrets));
        return;
      case "urgency":
        if (!reasons.has("urgency")) addReason(reasons, reason("urgency", POINTS.urgency));
        return;
      case "impersonation": {
        if (reasons.has("impersonated_link") || !foreignHost) return;
        const named = namedId ? ctx.institutions.get(namedId) : undefined;
        const fromBrand = institutionForBrand(review.brand, ctx);
        const name = named?.name ?? fromBrand?.name;
        if (!name) return;
        addReason(reasons, reason("impersonated_link", POINTS.impersonatedLink, `${name} (${defang(foreignHost)})`));
        institutionId ??= namedId ?? fromBrand?.id;
        return;
      }
      default: {
        const unexpected: never = clue;
        throw new Error(`Unexpected Gemini clue: ${String(unexpected)}`);
      }
    }
  };
  if (opts.gemini && text && input.kind !== "phone") {
    const review = await opts.gemini(text, hosts);
    if (review?.scam && review.confidence >= 0.5) {
      const pts = Math.round(review.confidence * POINTS.geminiMax * 10) / 10;
      addReason(reasons, reason("gemini_review", pts));
      for (const clue of review.clues) addGeminiClue(clue, review);
      addLureDestination();
      if (classification.scamType === "other" && review.confidence >= 0.7 && review.scamType !== "other") {
        classification = {
          ...classification,
          scamType: review.scamType,
          impersonatedBrand: review.brand,
          confidence: review.confidence,
        };
      }
      modelVersion = `${model.version}+gemini`;
    }
  }

  // ---- Pattern recognition: the whole text against known campaign messages ------
  const pattern = await patternPending;
  if (pattern && pattern.similarity >= PATTERN.signal && isConfirmed(pattern)) {
    addReason(reasons, reason("campaign_pattern", POINTS.campaignPattern, pattern.code));
  }

  // ---- Fusion ---------------------------------------------------------------------
  const analysed = Boolean(text || hosts.length || input.sender || phone);
  const listing = listingOverrides(listings, opts.now ?? new Date());
  const fused = fuse([...reasons.values()], {
    thresholds: ctx.thresholds,
    floor,
    cap,
    analysed,
    extraOverrides: listing.overrides,
  });
  if (!analysed) fused.reasons = [reason("not_analysed", 0)];

  const unavailable = new Set<string>();
  const confidencePenalties: number[] = [];
  if (s.senderMissing) {
    unavailable.add("sms_sender");
    for (const code of SENDER_SIGNALS) unavailable.add(code);
    confidencePenalties.push(SCORING.confidence.penalties.sender_missing);
  }
  if (ageUnavailable) {
    unavailable.add("domain_age");
    for (const code of AGE_SIGNALS) if (!reasons.has(code)) unavailable.add(code);
    confidencePenalties.push(SCORING.confidence.penalties.whois_failed);
  }
  if (text && hosts.length === 0 && input.kind !== "phone") {
    unavailable.add("text_only_no_url");
    confidencePenalties.push(SCORING.confidence.penalties.text_only_no_url);
  }
  const fired = new Set<string>([...reasons.keys(), ...(!analysed ? ["not_analysed"] : [])]);
  const signals: SignalAssessment[] = (Object.keys(REASONS) as ReasonCode[]).map((code) => ({
    code,
    state: signalState(code, fired, unavailable),
  }));
  const confidence = scoreConfidence(confidencePenalties);
  const verdict = verdictFor(fused.flag, fired, confidence, input.headers, listing.label);

  const iocCampaign = matchByIoc(iocList, ctx);
  const campaign: AnalysisResult["campaign"] = iocCampaign
    ? { id: iocCampaign.id, code: iocCampaign.code, matchType: "known", confidence: 1 }
    : pattern && pattern.similarity >= PATTERN.show
      ? { id: pattern.id, code: pattern.code, matchType: "similar", confidence: Math.round(pattern.similarity * 100) / 100 }
      : undefined;
  const inst = institutionId ? ctx.institutions.get(institutionId) : undefined;
  const indicators = buildIndicators({
    hosts, allUrls, officialHosts, hostSignals, ctx, reasons: [...reasons.values()],
    phones: input.kind === "phone" ? (phone ? [phone] : []) : extractPhones(text),
    emails: [...new Set([...(senderParts?.address ? [senderParts.address] : []), ...extractEmails(text)])],
    officialSenderId: s.officialInstitutionId,
    senderAddress: senderParts?.address,
  });
  return {
    ...fused,
    verdict,
    confidence,
    unavailableSignals: [...unavailable],
    signals,
    classification,
    features: { ...extractedEarly, claimedPlace: placeNamedInLure(input, ctx) },
    ...(campaign ? { campaign } : {}),
    indicators,
    ...(inst ? { matchedInstitution: { id: inst.id, name: inst.name } } : {}),
    iocs: [
      ...hosts.filter((h) => !officialHosts.has(h)).map((h) => ({ type: "domain" as const, value: defang(h) })),
      ...allUrls
        .filter((u) => !officialHosts.has(hostOf(u) ?? "") && hostOf(u) !== u.toLowerCase())
        .map((u) => ({ type: "url" as const, value: defang(u) })),
      ...(phone && !cap ? [{ type: "phone" as const, value: phone }] : []),
      ...(senderParts?.address && !s.officialInstitutionId ? [{ type: "email" as const, value: defang(senderParts.address) }] : []),
    ],
    modelVersion,
  };
}
