import type { DetectionContext } from "./context";
import { channelKey } from "./context";
import { extractUrls, foldText, hostOf, normalizePhone, parseSender } from "./normalize";
import type { AnalysisInput } from "./types";

export const FREEMAIL = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "aol.com", "icloud.com", "gmx.com",
  "mail.com", "proton.me", "protonmail.com", "yandex.com",
]);

export interface SenderFinding {
  authFails: ("spf" | "dkim" | "dmarc")[];
  /** Institution the sender pretends to be, if any. */
  claimedInstitutionId?: string;
  displaySpoof: boolean;
  replyToMismatch?: string;
  freemailInstitution: boolean;
  unknownSmsSender: boolean;
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

/** First institution named in the text (name or alias), if any. */
export function claimedInstitution(text: string, ctx: DetectionContext): string | undefined {
  const folded = foldText(text);
  for (const [id, inst] of ctx.institutions) {
    if (inst.folded.some((n) => folded.includes(n))) return id;
  }
  return undefined;
}

export function scoreSender(input: AnalysisInput, ctx: DetectionContext): SenderFinding {
  const f: SenderFinding = {
    authFails: [],
    displaySpoof: false,
    freemailInstitution: false,
    unknownSmsSender: false,
    capEligible: false,
  };
  const fullText = [input.sender, input.subject, input.text].filter(Boolean).join(" ");
  const claimed = claimedInstitution(fullText, ctx);
  if (claimed) f.claimedInstitutionId = claimed;

  const h = input.headers ?? {};
  for (const k of ["spf", "dkim", "dmarc"] as const) if (h[k] === "fail") f.authFails.push(k);

  if (!input.sender) return f;

  if (input.channel === "email" || input.kind === "email_signals") {
    const s = parseSender(input.sender);
    if (s.domain) {
      const officialId =
        isOfficialDomain(s.domain, ctx) ?? ctx.officialChannels.get(channelKey("email", s.address ?? ""));
      if (officialId) {
        f.officialInstitutionId = officialId;
        f.capEligible = h.spf === "pass" && h.dkim === "pass" && h.dmarc === "pass";
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
