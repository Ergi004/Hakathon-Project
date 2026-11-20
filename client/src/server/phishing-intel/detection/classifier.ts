import { foldText } from "@/server/detection/normalize";
import type { AnalysisResult } from "@/server/detection/types";
import type { Classification, Finding, ParsedMessage, Reputation } from "../types";

/**
 * Rules-based taxonomy (PDF §7.3, §19.2). Three separate dimensions:
 *  - phishing_type: the technique (credential phishing, BEC, OAuth, QR, malware delivery …)
 *  - phishing_family: the lure / impersonation theme (parcel fee, bank verification, toll fine …)
 *  - malware_family: only from file reputation (VirusTotal threat label), never guessed from text.
 * Every value carries the evidence that produced it; nothing is returned without evidence.
 */

export const PHISHING_TYPES = [
  "credential_phishing",
  "adversary_in_the_middle",
  "business_email_compromise",
  "oauth_phishing",
  "qr_phishing",
  "malware_delivery",
  "payment_fraud",
  "callback_scam",
  "brand_impersonation",
] as const;
export type PhishingType = (typeof PHISHING_TYPES)[number];

/**
 * Albanian words inflect heavily (paketa, paketën, gjobë, gjoba), so Albanian
 * entries are stems matched from a word start; English entries are whole words.
 */
export const PHISHING_FAMILIES: Record<string, RegExp> = {
  parcel_delivery_fee: /\b(?:paket|posta|postes|dergese|dergesa|kurrier|dogan)|\b(?:parcel|package|delivery|shipment|customs|courier)s?\b/,
  bank_account_verification: /\b(?:bank|llogari|kart|account|card|iban).{0,60}\b(?:verifik|konfirm|bllok|pezull|verify|confirm|locked|suspend)/,
  toll_traffic_fine: /\b(?:gjob|kundervajtj|policia rrugore|autostrad)|\b(?:toll|traffic fine|parking fine|speeding)\b/,
  tax_refund: /\b(?:tatim|rimburs)|\b(?:tax|refund|revenue)\b/,
  government_service: /\b(?:e-?albania|qeveri|ministri|bashki|pasaport)|\b(?:government|ministry|municipality|passport)\b/,
  utility_bill: /\b(?:oshee|energji|ujesjelles)|\b(?:electricity|water bill|utility)\b/,
  prize_lottery: /\b(?:fitu|cmim|shperblim|lotari)|\b(?:prize|winner|won|lottery|giveaway)\b/,
  job_offer: /\b(?:punesim|rroge|oferte pune)|\b(?:job|salary|recruit\w*|hiring|work from home)\b/,
  invoice_fraud: /\b(?:fatur|transferte)|\b(?:invoice|wire transfer|bank details|purchase order|remittance)\b/,
  account_suspension: /\b(?:llogaria (?:juaj )?(?:do te )?(?:bllok|pezull|mbyll))|\baccount (?:will be )?(?:suspend|locked|closed|deactivat)/,
  investment_crypto: /\b(?:investim|kripto|fitim i garantuar)|\b(?:bitcoin|crypto|trading|forex|guaranteed return)\b/,
};

const CREDENTIAL = /\b(hyr|identifik|fjalekalim|kredencial|login|log in|sign[ -]?in|password|verify your account|update your details|perditeso te dhenat)\b/;
const MFA = /\b(mfa|2fa|authenticator|dy faktor|two[- ]factor|verification code|kodi i verifikimit|session)\b/;
const BEC = /\b(wire transfer|transferte bankare|new bank details|llogari(?:ne)? e re bankare|ndrysho(?:ni)? llogarine|urgent payment|pagese urgjente|ceo|drejtori? ekzekutiv|confidential request|kerkese konfidenciale)\b/;
const QR = /\b(qr|skano kodin|scan the code|scan this code)\b/;
const OAUTH_URL = /(oauth2?\/(?:v2\.0\/)?authorize|\/oauth\/|[?&]client_id=.*[?&]scope=|[?&]scope=.*[?&]client_id=|\/consent)/i;
const FREEMAIL = /@(gmail|yahoo|outlook|hotmail|live|aol|proton(?:mail)?|gmx|mail|yandex|icloud)\.(com|me|net)$/i;

interface Input {
  msg: ParsedMessage;
  engine: AnalysisResult;
  findings: Finding[];
  reputations: Reputation[];
  urls: string[];
}

const conf = (n: number, base = 0.45, step = 0.15, max = 0.9) => Math.min(max, Number((base + step * (n - 1)).toFixed(2)));

export function classify({ msg, engine, findings, reputations, urls }: Input): Classification[] {
  const text = foldText([msg.subject, msg.text].filter(Boolean).join("\n"));
  const codes = new Set([...engine.reasons.map((r) => r.code), ...findings.map((f) => f.code)]);
  const has = (...c: string[]) => c.some((x) => codes.has(x));
  const hasLink = urls.length > 0;
  const types: Classification[] = [];
  const push = (value: PhishingType, evidence: string[]) => {
    if (evidence.length) types.push({ dimension: "phishing_type", value, confidence: conf(evidence.length), evidence, source: "rules" });
  };

  // Credential phishing
  const cred: string[] = [];
  if (has("password_field")) cred.push("HTML password field");
  if (has("html_form")) cred.push("HTML form that submits data");
  if (has("html_attachment")) cred.push("HTML attachment (offline login page pattern)");
  if (has("asks_secrets")) cred.push("Asks for credentials, card data or codes");
  if (CREDENTIAL.test(text) && hasLink) cred.push("Login / verification wording with a link");
  const exfil = msg.exfil ?? [];
  const exfilKinds = [...new Set(exfil.filter((e) => !(e.source === "email_html" && (e.kind === "form_action" || e.kind === "js_endpoint"))).map((e) => e.kind))];
  if (exfilKinds.length) cred.push(`Captured data is sent to: ${exfilKinds.map((k) => k.replace(/_/g, " ")).join(", ")}`);
  push("credential_phishing", cred);

  // AiTM: only with credential evidence AND MFA/session wording AND a lookalike or form. Kept "possible" (≤0.5).
  if (cred.length >= 2 && MFA.test(text) && has("lookalike_typosquat", "lookalike_homoglyph", "lookalike_combosquat", "subdomain_trick", "html_form")) {
    types.push({ dimension: "phishing_type", value: "adversary_in_the_middle", confidence: 0.4, evidence: ["Credential capture combined with MFA / session wording on a lookalike or form"], source: "rules" });
  }

  // BEC: email, payment instruction wording, sender anomaly, typically no link or attachment.
  if (msg.channel === "email") {
    const bec: string[] = [];
    if (BEC.test(text)) bec.push("Payment-change or executive-request wording");
    if (has("reply_to_mismatch")) bec.push("Reply-To differs from sender");
    if (msg.sender && FREEMAIL.test(msg.sender.replace(/>$/, ""))) bec.push("Sent from a free email account");
    if (has("display_name_spoof", "display_spoof")) bec.push("Display name impersonation");
    if (bec.length >= 2 && BEC.test(text)) push("business_email_compromise", bec);
  }

  // OAuth consent phishing
  const oauth = urls.filter((u) => OAUTH_URL.test(u));
  if (oauth.length) push("oauth_phishing", [`OAuth authorisation / consent link (${oauth.length})`]);

  // QR phishing
  const qr: string[] = [];
  if (QR.test(text)) qr.push("Asks to scan a QR code");
  if (msg.attachments.some((a) => /image\//i.test(a.mime)) && QR.test(text)) qr.push("Image attachment alongside QR instructions");
  if (has("qr_unknown")) qr.push("QR code leads to a non-official domain");
  push("qr_phishing", qr);

  // Malware delivery
  const mal: string[] = [];
  if (has("attachment_exec", "disguised_executable")) mal.push("Executable or macro attachment");
  if (has("attachment_double_ext")) mal.push("Double file extension");
  if (has("disk_image")) mal.push("Disk image attachment");
  if (has("app_install_lure")) mal.push("Asks to install an app / APK");
  if (has("remote_access_lure")) mal.push("Asks to install remote-access software");
  const badFiles = reputations.filter((r) => r.type === "file_hash" && r.malicious >= 2);
  if (badFiles.length) mal.push(`Attachment hash flagged by ${Math.max(...badFiles.map((b) => b.malicious))} VirusTotal engines`);
  push("malware_delivery", mal);

  // Payment fraud (fee / fine / prize with a link or IBAN)
  const pay: string[] = [];
  if (has("payment_lure")) pay.push("Asks for a payment or promises a refund");
  if (has("payment_handle")) pay.push("Includes a bank account for payment");
  if (pay.length && (hasLink || has("payment_handle"))) push("payment_fraud", pay);

  if (has("callback_lure")) push("callback_scam", ["Asks the recipient to call a number"]);

  // Brand impersonation (technique-agnostic)
  const brand: string[] = [];
  for (const r of engine.reasons) if (/^lookalike_|subdomain_trick|display_spoof|freemail_institution|unknown_sms_sender/.test(r.code)) brand.push(r.text_en);
  if (has("display_name_spoof")) brand.push("Display name embeds another domain");
  if (brand.length && engine.matchedInstitution) brand.unshift(`Imitates ${engine.matchedInstitution.name}`);
  push("brand_impersonation", brand.slice(0, 4));

  types.sort((a, b) => b.confidence - a.confidence);

  // Lure family
  const families: Classification[] = [];
  for (const [family, re] of Object.entries(PHISHING_FAMILIES)) {
    const m = text.match(re);
    if (m) families.push({ dimension: "phishing_family", value: family, confidence: types.length ? 0.6 : 0.35, evidence: [`Wording: "${m[0].slice(0, 60)}"`], source: "rules" });
  }
  if (engine.matchedInstitution) {
    for (const f of families) f.evidence.push(`Mentions or imitates ${engine.matchedInstitution.name}`);
  }

  // Malware family: only from file reputation labels.
  const malware: Classification[] = badFiles
    .filter((b) => b.threatLabel)
    .map((b) => ({
      dimension: "malware_family" as const,
      value: b.threatLabel!,
      confidence: b.malicious >= 10 ? 0.8 : 0.6,
      evidence: [`VirusTotal suggested threat label for ${b.value} (${b.malicious} engines)`],
      source: "virustotal" as const,
    }));

  return [...types, ...families.slice(0, 3), ...malware];
}
