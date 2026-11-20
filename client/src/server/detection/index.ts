import { hashInput } from "@/server/hash";
import { isConfirmed, matchByIoc } from "./campaigns";
import { channelKey, iocKey, type DetectionContext, type IocKind } from "./context";
import { scoreAttachments } from "./attachments";
import { parseHost, scoreDomain, type LookalikeClass } from "./domain-score";
import { fuse } from "./fusion";
import { defang, extractUrls, foldText, hostOf, normalizePhone, normalizeText, parseSender } from "./normalize";
import type { GeminiClue, GeminiReview } from "./gemini-review";
import { classifyScam, extractFeatures, type BrandCategory, type HostSignal } from "./pattern";
import { reason, type ReasonCode } from "./reasons";
import { matchSecrets, scoreRules, type RuleSignal } from "./rules";
import { claimedInstitution, scoreSender } from "./sender";
import { classify, type TextModel } from "./text-model";
import type { AnalysisInput, AnalysisResult, Reason } from "./types";
import { scoreWhois } from "./whois-score";

export type { AnalysisInput, AnalysisResult, Reason } from "./types";
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
  authFailEach: 10,
  authFailCap: 20,
  /** Each failed check when the claimed domain publishes quarantine or reject. */
  authFailStrict: 15,
  authFailStrictCap: 25,
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
  manyReports: 6,
} as const;

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

/** Strict when the mail says so, or when the From domain is an official domain and no policy says otherwise. */
function strictDmarc(input: AnalysisInput, ctx: DetectionContext): boolean {
  const policy = input.headers?.dmarcPolicy;
  if (policy === "reject" || policy === "quarantine") return true;
  if (policy === "none") return false;
  const domain = input.sender ? parseSender(input.sender).domain : undefined;
  if (!domain) return false;
  for (const official of ctx.officialDomains.keys()) {
    if (domain === official || domain.endsWith(`.${official}`)) return true;
  }
  return false;
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
  let floor = false;
  let cap = false;
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
  for (const host of hosts) {
    const d = scoreDomain(host, ctx);
    const w = scoreWhois(host, ctx, opts.now);
    const intel = ctx.domainIntel.get(host) ?? ctx.domainIntel.get(parseHost(host).registrable) ?? null;
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
    if (rules.asks_secrets) {
      const tier = matchSecrets(text)?.tier ?? "account";
      addReason(reasons, reason("asks_secrets", tier === "credential" ? POINTS.asksCredentials : POINTS.asksSecrets, rules.asks_secrets));
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
  if (s.authFails.length) {
    const strict = strictDmarc(input, ctx);
    const each = strict ? POINTS.authFailStrict : POINTS.authFailEach;
    const capPoints = strict ? POINTS.authFailStrictCap : POINTS.authFailCap;
    addReason(
      reasons,
      reason("auth_fail", Math.min(capPoints, s.authFails.length * each), s.authFails.map((x) => x.toUpperCase()).join(", ")),
    );
  }
  if (s.displaySpoof) addReason(reasons, reason("display_spoof", POINTS.displaySpoof, instName(s.claimedInstitutionId)));
  if (s.replyToMismatch) addReason(reasons, reason("reply_to_mismatch", POINTS.replyTo, defang(s.replyToMismatch)));
  if (s.freemailInstitution) addReason(reasons, reason("freemail_institution", POINTS.freemailInstitution, instName(s.claimedInstitutionId)));
  if (s.unknownSmsSender) addReason(reasons, reason("unknown_sms_sender", POINTS.unknownSmsSender, instName(s.claimedInstitutionId)));
  if (s.officialInstitutionId) {
    addReason(reasons, reason("official_sender", 0, instName(s.officialInstitutionId)));
    cap = s.capEligible;
  }
  if (!cap && input.channel === "sms" && reasons.has("impersonated_link") && namedId) {
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

  // ---- Attachments ----------------------------------------------------------------
  const a = scoreAttachments(input.attachments);
  if (a.exec) addReason(reasons, reason("attachment_exec", POINTS.attachmentExec, a.exec));
  if (a.doubleExt) addReason(reasons, reason("attachment_double_ext", POINTS.attachmentDoubleExt, a.doubleExt));
  if (a.archive) addReason(reasons, reason("attachment_archive", POINTS.attachmentArchive, a.archive));

  // ---- Reputation -----------------------------------------------------------------
  for (const i of iocList) {
    const key = iocKey(i.kind, i.value);
    const shown = i.kind === "domain" || i.kind === "url" ? defang(i.value) : i.value;
    if (ctx.blocklist.has(key)) {
      addReason(reasons, reason("known_bad", POINTS.knownBad, shown));
      floor = true;
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

  // ---- Fusion ---------------------------------------------------------------------
  const analysed = Boolean(text || hosts.length || input.sender || phone);
  const fused = fuse([...reasons.values()], { thresholds: ctx.thresholds, floor, cap, analysed });
  if (!analysed) fused.reasons = [reason("not_analysed", 0)];

  const campaign = matchByIoc(iocList, ctx);
  const inst = institutionId ? ctx.institutions.get(institutionId) : undefined;
  return {
    ...fused,
    classification,
    features: { ...extractedEarly, claimedPlace: placeNamedInLure(input, ctx) },
    ...(campaign ? { campaign: { id: campaign.id, code: campaign.code, matchType: "known" as const, confidence: 1 } } : {}),
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
