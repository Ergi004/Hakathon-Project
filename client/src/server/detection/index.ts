import { hashInput } from "@/server/hash";
import { isConfirmed, matchByIoc } from "./campaigns";
import { channelKey, iocKey, type DetectionContext, type IocKind } from "./context";
import { scoreAttachments } from "./attachments";
import { scoreDomain, type LookalikeClass } from "./domain-score";
import { fuse } from "./fusion";
import { defang, extractUrls, hostOf, normalizePhone, normalizeText, parseSender } from "./normalize";
import { reason, type ReasonCode } from "./reasons";
import { scoreRules } from "./rules";
import { scoreSender } from "./sender";
import { classify, type TextModel } from "./text-model";
import type { AnalysisInput, AnalysisResult, Reason } from "./types";
import { scoreWhois } from "./whois-score";

export type { AnalysisInput, AnalysisResult, Reason } from "./types";
export { createContext, type ContextData, type DetectionContext } from "./context";

/** Points from SPEC 6.3. */
export const POINTS = {
  lookalike: { typosquat: 20, homoglyph: 25, combosquat: 18, subdomain_trick: 20 } satisfies Record<LookalikeClass, number>,
  punycode: 8,
  domainNew: 10,
  oddTld: 5,
  shortener: 6,
  linkMismatch: 8,
  qrUnknown: 10,
  certFast: 4,
  certBrand: 4,
  whoisPrivacy: 2,
  infraPattern: 3,
  classifierMax: 15,
  urgency: 4,
  paymentLure: 4,
  threat: 4,
  asksSecrets: 8,
  authFailEach: 10,
  authFailCap: 20,
  displaySpoof: 10,
  replyTo: 6,
  freemailInstitution: 10,
  unknownSmsSender: 12,
  attachmentExec: 10,
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
}

/** Keep the strongest reason per code. */
function addReason(list: Map<string, Reason>, r: Reason) {
  const prev = list.get(r.code);
  if (!prev || r.weight > prev.weight) list.set(r.code, r);
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

  // ---- Links ----------------------------------------------------------------------
  const officialHosts = new Set<string>();
  for (const host of hosts) {
    const d = scoreDomain(host, ctx);
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
    if (d.punycode) addReason(reasons, reason("punycode", POINTS.punycode, shown));
    if (d.oddTld) addReason(reasons, reason("odd_tld", POINTS.oddTld, shown));
    if (d.shortener) addReason(reasons, reason("shortener", POINTS.shortener, shown));
    if (input.kind === "qr" || input.channel === "qr") addReason(reasons, reason("qr_unknown", POINTS.qrUnknown, shown));

    const w = scoreWhois(host, ctx, opts.now);
    if (w?.young) addReason(reasons, reason("domain_new", POINTS.domainNew, shown));
    if (w?.certFast) addReason(reasons, reason("cert_fast", POINTS.certFast, shown));
    if (w?.certBrand) addReason(reasons, reason("cert_brand", POINTS.certBrand, shown));
    if (w?.privacy) addReason(reasons, reason("whois_privacy", POINTS.whoisPrivacy, shown));
    if (w?.riskyInfra) addReason(reasons, reason("infra_pattern", POINTS.infraPattern, shown));
  }

  // Visible text names an official domain while the actual link (href) goes elsewhere.
  if (hrefs.length && textUrls.some((u) => officialHosts.has(hostOf(u) ?? ""))) {
    const off = hrefs.map(hostOf).find((h) => h && !officialHosts.has(h));
    if (off) addReason(reasons, reason("link_mismatch", POINTS.linkMismatch, defang(off)));
  }

  // ---- Content --------------------------------------------------------------------
  const model = classify(input.kind === "phone" ? "" : text, opts.model);
  if (text && input.kind !== "phone") {
    const pts = Math.round(model.probability * POINTS.classifierMax * 10) / 10;
    if (model.probability >= 0.5) addReason(reasons, reason("classifier", pts));
    const rules = scoreRules(text);
    if (rules.urgency) addReason(reasons, reason("urgency", POINTS.urgency, rules.urgency));
    if (rules.payment_lure) addReason(reasons, reason("payment_lure", POINTS.paymentLure, rules.payment_lure));
    if (rules.threat) addReason(reasons, reason("threat", POINTS.threat, rules.threat));
    if (rules.asks_secrets) addReason(reasons, reason("asks_secrets", POINTS.asksSecrets, rules.asks_secrets));
  }

  // ---- Sender ---------------------------------------------------------------------
  const s = scoreSender(input, ctx);
  const instName = (id?: string) => (id ? ctx.institutions.get(id)?.name : undefined);
  if (s.authFails.length) {
    addReason(
      reasons,
      reason("auth_fail", Math.min(POINTS.authFailCap, s.authFails.length * POINTS.authFailEach), s.authFails.map((x) => x.toUpperCase()).join(", ")),
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
    if ((ctx.recentReporters.get(key) ?? 0) >= 3) addReason(reasons, reason("many_reports", POINTS.manyReports, shown));
  }

  // ---- Fusion ---------------------------------------------------------------------
  const analysed = Boolean(text || hosts.length || input.sender || phone);
  const fused = fuse([...reasons.values()], { thresholds: ctx.thresholds, floor, cap, analysed });
  if (!analysed) fused.reasons = [reason("not_analysed", 0)];

  const campaign = matchByIoc(iocList, ctx);
  const inst = institutionId ? ctx.institutions.get(institutionId) : undefined;

  return {
    ...fused,
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
    modelVersion: model.version,
  };
}
