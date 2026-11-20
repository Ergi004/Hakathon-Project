import PostalMime, { type Address } from "postal-mime";
import type { ScanRequest } from "@/lib/schemas/phishing-intel";
import { exfilFindings, extractExfil, isScriptableAttachment, type ExfilEndpoint } from "../../intelligence/exfil-extractor";
import type { AttachmentMeta, ParsedMessage, ScanSource } from "../../types";
import { analyzeAttachments, fromContent } from "./attachment-analyzer";
import { analyzeHeaders, headerMapFrom, parseHeaderBlock, type HeaderMap } from "./header-analyzer";
import { analyzeHtml } from "./html-analyzer";

type EmailInput = Extract<ScanRequest, { channel: "EMAIL" }>["email"];

const MAX_ATTACHMENTS = 50;
/** Larger HTML/JS attachments are still hashed, but not read as text. */
const MAX_SCRIPT_ATTACHMENT = 2 * 1024 * 1024;

function formatAddress(a: Address | undefined): string | undefined {
  if (!a) return undefined;
  if ("group" in a && a.group) return a.group.map((m) => m.address).join(", ");
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

function toBytes(c: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof c === "string") return new TextEncoder().encode(c);
  return c instanceof Uint8Array ? c : new Uint8Array(c);
}

/**
 * EML (or structured webmail fields) → ParsedMessage. Resource limits guard
 * against MIME bombs; attachment bytes are hashed and sniffed, then dropped.
 */
export async function parseEmail(email: EmailInput, source: ScanSource, locale: "sq" | "en"): Promise<ParsedMessage> {
  let headers: HeaderMap;
  let subject = email.subject;
  let text = email.body ?? "";
  let html = email.html;
  let overrides: { sender?: string; replyTo?: string; returnPath?: string } = {
    sender: email.sender,
    replyTo: email.replyTo,
    returnPath: email.returnPath,
  };
  let attachments: AttachmentMeta[] = email.attachments.map((a) => ({ name: a.name, mime: a.mime, size: a.size, sha256: a.sha256?.toLowerCase() }));
  const exfil: ExfilEndpoint[] = [];
  let ipLookup = false;

  if (email.raw) {
    const parsed = await PostalMime.parse(email.raw, {
      attachmentEncoding: "arraybuffer",
      maxNestingDepth: 20,
      maxPartCount: 200,
      maxHeadersSize: 256 * 1024,
      maxRfc822NestingDepth: 3,
    });
    headers = headerMapFrom(parsed.headers);
    subject = parsed.subject;
    text = parsed.text ?? "";
    html = parsed.html;
    overrides = {
      sender: formatAddress(parsed.from),
      replyTo: formatAddress(parsed.replyTo?.[0]),
      returnPath: parsed.returnPath,
    };
    attachments = [];
    for (const a of parsed.attachments.slice(0, MAX_ATTACHMENTS)) {
      const bytes = toBytes(a.content);
      const name = a.filename ?? "unnamed";
      attachments.push(fromContent(name, a.mimeType, bytes));
      // HTML/SVG/JS attachments are read as text (never rendered) to find where they send data.
      const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 512));
      if (bytes.byteLength <= MAX_SCRIPT_ATTACHMENT && isScriptableAttachment(name, a.mimeType, head)) {
        const r = extractExfil(new TextDecoder("utf-8", { fatal: false }).decode(bytes), { source: "attachment", origin: name.slice(0, 255), mode: "full" });
        exfil.push(...r.endpoints);
        ipLookup ||= r.ipLookup;
      }
    }
  } else {
    headers = email.headers ? parseHeaderBlock(email.headers) : new Map();
  }

  const header = analyzeHeaders(headers, overrides);
  const htmlA = html ? analyzeHtml(html) : null;
  const hrefs = [...(htmlA?.hrefs ?? []), ...email.urls.map((u) => ({ href: u, display: "" }))];

  if (html) {
    const r = extractExfil(html, { source: "email_html", mode: "full" });
    exfil.push(...r.endpoints);
    ipLookup ||= r.ipLookup;
  }
  if (text) exfil.push(...extractExfil(text, { source: "text", mode: "tokens" }).endpoints);
  const endpoints = dedupeExfil(exfil);

  return {
    channel: "email",
    source,
    subject,
    sender: header.sender,
    replyTo: header.replyTo,
    returnPath: header.returnPath,
    text: text.trim() || htmlA?.text || "",
    hrefs,
    attachments,
    auth: header.auth,
    headerFindings: [...header.findings, ...(htmlA?.findings ?? []), ...analyzeAttachments(attachments), ...exfilFindings(endpoints, ipLookup)],
    exfil: endpoints,
    locale,
  };
}

/** Same endpoint found in the body and an attachment, or in several layers: keep one, prefer the plain-text sighting. */
function dedupeExfil(list: ExfilEndpoint[]): ExfilEndpoint[] {
  const map = new Map<string, ExfilEndpoint>();
  for (const e of list) {
    const prev = map.get(e.key);
    if (!prev) map.set(e.key, e);
    else if (!prev.chatId && e.chatId) map.set(e.key, { ...prev, chatId: e.chatId });
  }
  return [...map.values()].slice(0, 50);
}
