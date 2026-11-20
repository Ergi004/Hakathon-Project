import { distance } from "fastest-levenshtein";
import type { DetectionContext } from "./context";
import { channelKey } from "./context";
import { extractUrls, foldText, hostOf, normalizePhone, parseSender } from "./normalize";
import type { AnalysisInput } from "./types";

export const FREEMAIL = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "aol.com", "icloud.com", "gmx.com",
  "mail.com", "proton.me", "protonmail.com", "yandex.com",
]);

export type DmarcResult = "pass" | "fail" | "none" | "unavailable";
export type SpoofPolicy = "quarantine" | "reject";

/**
 * DMARC is the authentication result. SPF fail with an aligned DKIM pass is a
 * DMARC pass. A missing result is unavailable, not a failure.
 */
export function evaluateDmarc(headers: AnalysisInput["headers"]): DmarcResult {
  const h = headers ?? {};
  if (h.spf === "fail" && h.dkim === "pass" && h.dkimAligned === true) return "pass";
  if (h.dmarc === "pass" || h.dmarc === "fail" || h.dmarc === "none") return h.dmarc;
  if (h.spf === "fail" && (h.dkim === "fail" || h.dkimAligned === false)) return "fail";
  return "unavailable";
}

function publishedSpoofPolicy(policy: "none" | "quarantine" | "reject" | undefined): SpoofPolicy | null {
  switch (policy) {
    case "quarantine":
    case "reject":
      return policy;
    case "none":
    case undefined:
      return null;
    default: {
      const unexpected: never = policy;
      return unexpected;
    }
  }
}

export interface SenderFinding {
  /** True only when the DMARC result is fail. */
  dmarcFail: boolean;
  /** DMARC fail on an institution domain that publishes quarantine or reject. */
  institutionSpoof: SpoofPolicy | null;
  spoofDomain?: string;
  /** Institution the sender pretends to be, if any. */
  claimedInstitutionId?: string;
  displaySpoof: boolean;
  replyToMismatch?: string;
  freemailInstitution: boolean;
  unknownSmsSender: boolean;
  /** SMS or call arrived with no sender value, so sender signals cannot be judged. */
  senderMissing: boolean;
  /** Sender is an official channel or official domain. */
  officialInstitutionId?: string;
  /** Official sender AND all auth pass (or SMS sender exact match): SPEC 6.3 cap rule. */
  capEligible: boolean;
}

function messageHasLink(input: AnalysisInput): boolean {
  if (input.urls?.some((url) => url.trim())) return true;
  return extractUrls([input.subject, input.text].filter(Boolean).join("\n")).length > 0;
}

function isOfficialDomain(domain: string, ctx: DetectionContext): string | undefined {
  for (const [official, id] of ctx.officialDomains) {
    if (domain === official || domain.endsWith(`.${official}`)) return id;
  }
  return undefined;
}

function nameWords(value: string): string[] {
  return value.split(/[^a-z0-9]+/).filter((word) => word.length > 0);
}

/** How far a same-length word window is from an institution name. Null when it is not a near miss. */
function nearestGap(words: string[], name: string): number | null {
  const expected = nameWords(name);
  if (name.length < 8 || expected.length === 0 || words.length < expected.length) return null;
  const maxDistance = name.length >= 12 ? 2 : 1;
  let best: number | null = null;
  for (let i = 0; i <= words.length - expected.length; i++) {
    const window = words.slice(i, i + expected.length).join(" ");
    if (Math.abs(window.length - name.length) > maxDistance) continue;
    const gap = distance(window, name);
    if (gap > 0 && gap <= maxDistance && (best === null || gap < best)) best = gap;
  }
  return best;
}

/** First institution named in the text (name or alias), if any. A one- or two-letter miss still counts. */
export function claimedInstitution(text: string, ctx: DetectionContext): string | undefined {
  const folded = foldText(text);
  for (const [id, inst] of ctx.institutions) {
    if (inst.folded.some((n) => folded.includes(n))) return id;
  }
  const words = nameWords(folded);
  let best: { id: string; gap: number; length: number } | undefined;
  for (const [id, inst] of ctx.institutions) {
    for (const name of inst.folded) {
      const gap = nearestGap(words, name);
      if (gap === null) continue;
      if (!best || gap < best.gap || (gap === best.gap && name.length > best.length)) {
        best = { id, gap, length: name.length };
      }
    }
  }
  return best?.id;
}

export function scoreSender(input: AnalysisInput, ctx: DetectionContext): SenderFinding {
  const f: SenderFinding = {
    dmarcFail: false,
    institutionSpoof: null,
    displaySpoof: false,
    freemailInstitution: false,
    unknownSmsSender: false,
    senderMissing: false,
    capEligible: false,
  };
  const fullText = [input.sender, input.subject, input.text].filter(Boolean).join(" ");
  const claimed = claimedInstitution(fullText, ctx);
  if (claimed) f.claimedInstitutionId = claimed;

  const h = input.headers ?? {};
  const email = input.channel === "email" || input.kind === "email_signals";
  const dmarc = email ? evaluateDmarc(input.headers) : "unavailable";
  f.dmarcFail = dmarc === "fail";

  if (!input.sender?.trim()) {
    if (input.channel === "sms" || input.channel === "call") f.senderMissing = true;
    return f;
  }

  if (input.channel === "email" || input.kind === "email_signals") {
    const s = parseSender(input.sender);
    if (s.domain) {
      const domainInstitution = isOfficialDomain(s.domain, ctx);
      const officialId = domainInstitution ?? ctx.officialChannels.get(channelKey("email", s.address ?? ""));
      const policy = publishedSpoofPolicy(h.dmarcPolicy);
      if (dmarc === "fail" && domainInstitution && policy) {
        f.institutionSpoof = policy;
        f.spoofDomain = s.domain;
      }
      if (officialId) {
        f.officialInstitutionId = officialId;
        f.capEligible = dmarc === "pass";
      } else {
        const displayClaim = s.display ? claimedInstitution(s.display, ctx) : undefined;
        if (displayClaim) {
          f.displaySpoof = true;
          f.claimedInstitutionId = displayClaim;
        }
        if (FREEMAIL.has(s.domain) && (displayClaim || claimed)) f.freemailInstitution = true;
      }
      if (h.replyTo) {
        const rt = parseSender(h.replyTo);
        const rtDomain = rt.domain ?? hostOf(h.replyTo);
        if (rtDomain && rtDomain !== s.domain) f.replyToMismatch = rt.address ?? rtDomain;
      }
    }
    return f;
  }

  // SMS / call: alphanumeric sender id or phone number
  const sender = input.sender.trim();
  const isPhone = /^[+\d][\d\s.-]{5,}$/.test(sender);
  const key = isPhone ? channelKey("phone", normalizePhone(sender)) : channelKey("sms_sender", sender);
  const officialId = ctx.officialChannels.get(key);
  if (officialId) {
    f.officialInstitutionId = officialId;
    f.capEligible = true;
  } else if (claimed || messageHasLink(input)) {
    f.unknownSmsSender = true;
  }
  return f;
}
