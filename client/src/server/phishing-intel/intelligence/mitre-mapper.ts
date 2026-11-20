import type { Classification, Finding, ParsedMessage, TechniqueHit } from "../types";

/**
 * Maps observed evidence to MITRE ATT&CK techniques (PDF §7.5). A technique is
 * listed only when a concrete observation supports it; ATT&CK describes
 * behaviour and never by itself identifies an actor.
 * Reference: https://attack.mitre.org/
 */
const T = {
  "T1566.001": { name: "Phishing: Spearphishing Attachment", tactic: "Initial Access" },
  "T1566.002": { name: "Phishing: Spearphishing Link", tactic: "Initial Access" },
  "T1598.003": { name: "Phishing for Information: Spearphishing Link", tactic: "Reconnaissance" },
  T1660: { name: "Phishing (Mobile)", tactic: "Initial Access" },
  T1656: { name: "Impersonation", tactic: "Defense Evasion" },
  "T1204.001": { name: "User Execution: Malicious Link", tactic: "Execution" },
  "T1204.002": { name: "User Execution: Malicious File", tactic: "Execution" },
  T1557: { name: "Adversary-in-the-Middle", tactic: "Credential Access" },
  T1528: { name: "Steal Application Access Token", tactic: "Credential Access" },
  T1111: { name: "Multi-Factor Authentication Interception", tactic: "Credential Access" },
  "T1036.007": { name: "Masquerading: Double File Extension", tactic: "Defense Evasion" },
  T1027: { name: "Obfuscated Files or Information", tactic: "Defense Evasion" },
  "T1056.003": { name: "Input Capture: Web Portal Capture", tactic: "Collection" },
  T1567: { name: "Exfiltration Over Web Service", tactic: "Exfiltration" },
  "T1567.004": { name: "Exfiltration Over Webhook", tactic: "Exfiltration" },
} as const;
type Tid = keyof typeof T;

export function mapTechniques(input: {
  msg: ParsedMessage;
  classifications: Classification[];
  findings: Finding[];
  reasonCodes: string[];
  urlCount: number;
  verdictIsBenign: boolean;
}): TechniqueHit[] {
  if (input.verdictIsBenign) return [];
  const hits = new Map<Tid, string>();
  const add = (id: Tid, observation: string) => {
    if (!hits.has(id)) hits.set(id, observation);
  };
  const types = new Set(input.classifications.filter((c) => c.dimension === "phishing_type").map((c) => c.value));
  const codes = new Set([...input.reasonCodes, ...input.findings.map((f) => f.code)]);
  const isEmail = input.msg.channel === "email";

  if (isEmail && input.urlCount > 0 && types.size) add("T1566.002", `${input.urlCount} link(s) in a message classified as ${[...types][0]}`);
  if (isEmail && (types.has("malware_delivery") || codes.has("html_attachment")) && input.msg.attachments.length) {
    add("T1566.001", `Attachment(s): ${input.msg.attachments.map((a) => a.name).slice(0, 3).join(", ")}`);
  }
  if (!isEmail && input.urlCount > 0 && types.size) add("T1660", "SMS containing a link classified as phishing");
  if (types.has("credential_phishing") && input.urlCount > 0) add("T1598.003", "Link leads to a credential-collection lure");
  if (types.has("brand_impersonation") || types.has("business_email_compromise")) add("T1656", "Sender or domain impersonates a trusted organisation");
  if (input.urlCount > 0 && types.size) add("T1204.001", "Relies on the recipient opening a link");
  if (types.has("malware_delivery") && input.msg.attachments.length) add("T1204.002", "Relies on the recipient opening a file");
  if (types.has("adversary_in_the_middle")) add("T1557", "Possible session / MFA token capture page (assessment, not confirmed)");
  if (types.has("oauth_phishing")) add("T1528", "OAuth consent link requesting application access");
  if (codes.has("otp_request")) add("T1111", "Asks the recipient to share a one-time code");
  if (codes.has("attachment_double_ext")) add("T1036.007", "Attachment uses a double extension");
  if (codes.has("html_obfuscation") || codes.has("data_uri_html") || codes.has("rtl_override")) add("T1027", "Content is obfuscated (entities, data URIs or bidi overrides)");
  if (codes.has("obfuscated_exfil")) add("T1027", "The data destination is hidden with encoding");

  // Where captured credentials go (static analysis of forms and scripts).
  const exfil = input.msg.exfil ?? [];
  const pick = (kinds: string[]) => exfil.find((e) => kinds.includes(e.kind));
  const hook = pick(["discord_webhook", "webhook"]);
  if (hook) add("T1567.004", `Captured data is posted to a webhook (${hook.display})`);
  const web = pick(["telegram_bot", "google_apps_script", "google_form", "form_service"]);
  if (web) add("T1567", `Captured data is sent through a web service (${web.kind.replace(/_/g, " ")}: ${web.display})`);
  const portal = exfil.find((e) => e.source !== "email_html" || !["form_action", "js_endpoint"].includes(e.kind)) ?? (codes.has("password_field") ? exfil[0] : undefined);
  if (portal && types.has("credential_phishing")) add("T1056.003", `A fake login form captures what the victim types and sends it to ${portal.display}`);

  return [...hits].map(([id, observation]) => ({ id, ...T[id], observation }));
}
