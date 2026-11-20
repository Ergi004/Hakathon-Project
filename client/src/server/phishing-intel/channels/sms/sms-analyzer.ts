import { foldText, normalizePhone } from "@/server/detection/normalize";
import { extractExfil } from "../../intelligence/exfil-extractor";
import type { Finding, ParsedMessage, ScanSource } from "../../types";

export type SenderKind = "e164" | "short_code" | "alphanumeric" | "malformed" | "absent";

export interface SmsSender {
  kind: SenderKind;
  normalized: string | null;
  international: boolean;
}

/** E.164 phone, short code or alphanumeric sender ID (PDF §19.2). */
export function parseSmsSender(raw?: string): SmsSender {
  const v = (raw ?? "").normalize("NFKC").trim();
  if (!v) return { kind: "absent", normalized: null, international: false };
  if (/^\d{3,6}$/.test(v)) return { kind: "short_code", normalized: v, international: false };
  if (/^[+0(]?[\d\s().-]{7,20}$/.test(v)) {
    const digits = v.replace(/\D/g, "");
    // International prefixes first: normalizePhone would treat "0044…" as an Albanian 0-prefixed number.
    const e164 = v.startsWith("+") ? `+${digits}` : v.startsWith("00") ? `+${digits.slice(2)}` : normalizePhone(v);
    if (!e164 || !/^\+\d{8,15}$/.test(e164)) return { kind: "malformed", normalized: v.replace(/\s/g, ""), international: false };
    return { kind: "e164", normalized: e164, international: !e164.startsWith("+355") };
  }
  if (/^(?=.*[a-z])[a-z0-9 ._-]{2,11}$/i.test(v)) return { kind: "alphanumeric", normalized: v.toUpperCase(), international: false };
  return { kind: "malformed", normalized: v.slice(0, 32), international: false };
}

const RTL_OVERRIDE = /[‪-‮⁦-⁩]/;
const LATIN = /\p{Script=Latin}/u;
const CONFUSABLE_SCRIPTS = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/;
const CALLBACK = /(?:\+|00)?\d[\d\s().-]{7,16}\d/;

/** Mobile-specific lures (PDF §19.2), Albanian and English, matched on folded text. */
const LURES: { code: string; detail: string; weight: number; re: RegExp }[] = [
  { code: "app_install_lure", detail: "Asks to install an app or APK", weight: 15, re: /\b(apk|shkarko (?:aplikacionin|app)|instalo (?:aplikacionin|app)|install (?:the )?app|download (?:the )?app|sideload)\b/ },
  { code: "remote_access_lure", detail: "Mentions a remote-support app", weight: 15, re: /\b(anydesk|teamviewer|quicksupport|rustdesk|airdroid)\b/ },
  { code: "disable_protection", detail: "Asks to disable device protections", weight: 15, re: /\b(cakt?ivizo|disable|turn off) (?:play protect|antivirus|mbrojtjen|protection)\b/ },
  { code: "channel_switch", detail: "Pushes the conversation to another app", weight: 5, re: /\b(whatsapp|telegram|viber|signal)\b/ },
  { code: "otp_request", detail: "Asks the recipient to share a one-time code", weight: 15, re: /\b(dergo|na dergo|mos ndaj|send|share|reply with)\b.{0,40}\b(kod|code|otp)\b/ },
];

export function analyzeSmsText(text: string, sender: SmsSender): Finding[] {
  const findings: Finding[] = [];
  const folded = foldText(text);

  if (RTL_OVERRIDE.test(text)) findings.push({ code: "rtl_override", detail: "Text contains bidirectional override characters that can disguise links", weight: 15 });
  for (const word of text.split(/\s+/)) {
    if (word.length > 3 && LATIN.test(word) && CONFUSABLE_SCRIPTS.test(word)) {
      findings.push({ code: "mixed_script", detail: "A word mixes Latin with Cyrillic or Greek letters (homoglyphs)", evidence: word.slice(0, 40), weight: 12 });
      break;
    }
  }
  for (const l of LURES) if (l.re.test(folded)) findings.push({ code: l.code, detail: l.detail, weight: l.weight });

  if (IBAN.test(text.toUpperCase())) findings.push({ code: "payment_handle", detail: "Contains a bank account (IBAN) for payment", weight: 8 });
  const hasUrl = /https?:\/\/|www\.|\[\.\]/i.test(text);
  if (!hasUrl && CALLBACK.test(text) && /\b(telefono\w*|merr\w* ne telefon|thirr\w*|call|kontakto\w*|contact)\b/.test(folded)) {
    findings.push({ code: "callback_lure", detail: "Asks the recipient to call back a number", weight: 10 });
  }

  if (sender.kind === "malformed") findings.push({ code: "malformed_sender", detail: "Sender number is malformed", evidence: sender.normalized ?? undefined, weight: 6 });
  if (sender.kind === "e164" && sender.international) {
    findings.push({ code: "international_sender", detail: "Sent from a foreign number", evidence: sender.normalized ?? undefined, weight: 4 });
  }
  return findings;
}

export function parseSms(
  message: { text: string; sender?: string; receivedAt?: string },
  source: ScanSource,
  locale: "sq" | "en",
): ParsedMessage & { smsSender: SmsSender } {
  const smsSender = parseSmsSender(message.sender);
  return {
    channel: "sms",
    source,
    sender: message.sender,
    text: message.text,
    hrefs: [],
    attachments: [],
    auth: { spf: "none", dkim: "none", dmarc: "none", source: "absent" },
    headerFindings: analyzeSmsText(message.text, smsSender),
    // SMS carry links, not forms: only bot tokens / webhooks pasted in the text count.
    exfil: extractExfil(message.text, { source: "text", mode: "tokens" }).endpoints,
    receivedAt: message.receivedAt,
    locale,
    smsSender,
  };
}
