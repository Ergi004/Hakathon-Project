/**
 * Read whatever a citizen pasted into the message box: a full email (with its header lines),
 * an SMS, a bare link or a bare phone number. Pure and synchronous; nothing is fetched.
 */
import { extractUrls, normalizePhone } from "./normalize";

export type PastedKind = "email" | "message" | "link" | "phone";

export interface PastedInput {
  kind: PastedKind;
  /** The text to analyse: the email body without its header lines, or the whole paste. */
  body: string;
  sender?: string;
  subject?: string;
  replyTo?: string;
}

/** Header names as mail clients show them in Albanian and English. */
const HEADERS: Record<string, "sender" | "subject" | "replyTo" | "ignore"> = {
  from: "sender", nga: "sender", sender: "sender", "dërguesi": "sender", derguesi: "sender", "dërgues": "sender",
  subject: "subject", subjekti: "subject", tema: "subject", "objekti": "subject",
  "reply-to": "replyTo", "përgjigju": "replyTo", "pergjigju": "replyTo", "përgjigju te": "replyTo",
  to: "ignore", "për": "ignore", per: "ignore", cc: "ignore", bcc: "ignore", date: "ignore", data: "ignore", sent: "ignore", "dërguar": "ignore",
};
const HEADER_LINE = /^\s*([A-Za-zËëÇç][A-Za-zËëÇç -]{0,14}):\s*(.*)$/;
const FORWARD_MARK = /^[-—–\s]*(forwarded message|mesazh i përcjellë|original message|mesazhi origjinal)[-—–\s]*$/i;
/** How many leading lines may hold headers (forward markers and blank lines included). */
const HEADER_WINDOW = 14;

const URL_ONLY = /^(?:(?:https?|hxxps?):\/\/)?[^\s/]+\.[^\s]{2,}$/i;
const PHONE_ONLY = /^\+?[\d\s().-]{7,20}$/;

export function parsePasted(raw: string): PastedInput {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const single = text.split("\n").length === 1 && !/\s/.test(text.replace(/^\s+|\s+$/g, ""));

  if (single && URL_ONLY.test(text) && extractUrls(text).length === 1) return { kind: "link", body: text };
  if (PHONE_ONLY.test(text) && normalizePhone(text).replace(/\D/g, "").length >= 8) return { kind: "phone", body: text };

  const lines = text.split("\n");
  const found: Partial<Record<"sender" | "subject" | "replyTo", string>> = {};
  let headerCount = 0;
  let bodyStart = 0;
  for (let i = 0; i < Math.min(lines.length, HEADER_WINDOW); i++) {
    const line = lines[i];
    if (!line.trim() || FORWARD_MARK.test(line)) {
      if (headerCount && !line.trim()) {
        bodyStart = i + 1;
        break;
      }
      continue;
    }
    const m = HEADER_LINE.exec(line);
    const role = m ? HEADERS[m[1].trim().toLowerCase()] : undefined;
    if (!m || !role) {
      // The first non-header line ends the header block.
      if (headerCount) bodyStart = i;
      break;
    }
    headerCount++;
    bodyStart = i + 1;
    if (role !== "ignore" && m[2].trim()) found[role] ??= m[2].trim().slice(0, 320);
  }

  // A real header block names a sender or a subject; one stray "Data: …" line is not an email.
  if (headerCount && (found.sender || found.subject)) {
    const body = lines.slice(bodyStart).join("\n").trim();
    return { kind: "email", body: body || text, sender: found.sender, subject: found.subject, replyTo: found.replyTo };
  }
  return { kind: "message", body: text };
}
