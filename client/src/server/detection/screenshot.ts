/**
 * Turn what image recognition read from a screenshot into the normal scan input, so a screenshot
 * goes through exactly the same scoring, pattern and campaign matching as pasted text.
 *
 * The reading is transcription only. Brands and logos it reports are shown to the citizen but do
 * not add risk: a misread logo must not raise a verdict on its own (SPEC rule 7).
 */
import type { ScreenshotReading } from "@/server/llm";
import { defang, extractUrls, hostOf, normalizeText } from "./normalize";
import type { AnalysisInput, Channel } from "./types";

export interface ScreenshotContext {
  messageKind: Exclude<ScreenshotReading["kind"], "none"> | "qr_only";
  /** The transcript with every link defanged, for display, "edit and rescan" and reporting. */
  body: string;
  sender: string | null;
  subject: string | null;
  brands: string[];
  hasQrCode: boolean;
  /** Links decoded on the device from a QR code in the screenshot. */
  qrLinks: string[];
}

/** Defang only the links in a text: sentence full stops and line breaks stay as they are. */
export function defangLinks(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      let out = normalizeText(line);
      for (const url of extractUrls(out).sort((a, b) => b.length - a.length)) {
        const shown = defang(url);
        for (const variant of [url, url.replace(/^https?:\/\//i, "")]) if (variant !== shown) out = out.split(variant).join(shown);
      }
      return out.replace(/hxxps?:\/\/hxxp(s?):\/\//gi, "hxxp$1://");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CHANNEL: Record<ScreenshotReading["kind"], Channel> = { email: "email", sms: "sms", chat: "social", social: "social", webpage: "web", other: "other", none: "other" };

/** Sender as the scorer expects it: "Name <address>" for email, the number or short code for SMS. */
function senderOf(r: ScreenshotReading): string | undefined {
  const name = r.sender?.trim() || null;
  const address = r.senderAddress?.trim() || null;
  if (r.kind === "email") {
    if (name && address && !name.includes(address)) return `${name.replace(/<.*>/, "").trim()} <${address}>`;
    return address ?? name ?? undefined;
  }
  return address ?? name ?? undefined;
}

export function screenshotToInput(
  reading: ScreenshotReading | null,
  qrLinks: string[],
  locale: "sq" | "en",
): { input: AnalysisInput; screenshot: ScreenshotContext } | null {
  const qr = [...new Set(qrLinks.map((u) => u.trim()).filter(Boolean))].slice(0, 5);
  if (!reading) {
    // No readable message, but the device decoded a QR code: scan its link like the QR tab does.
    if (!qr.length) return null;
    return {
      input: { kind: "qr", urls: qr, channel: "qr", locale },
      screenshot: { messageKind: "qr_only", body: "", sender: null, subject: null, brands: [], hasQrCode: true, qrLinks: qr },
    };
  }
  // Links seen outside the body (buttons, browser bar) become extra hrefs; body links are read from the text.
  const bodyHosts = new Set(extractUrls(reading.body).map(hostOf));
  const extra = reading.links.filter((l) => !l.includes("@") && hostOf(l) && !bodyHosts.has(hostOf(l)));
  const urls = [...new Set([...extra, ...qr])];
  const sender = senderOf(reading);
  return {
    input: {
      kind: "text",
      text: reading.body,
      ...(reading.kind === "email" && reading.subject ? { subject: reading.subject } : {}),
      ...(sender ? { sender } : {}),
      ...(urls.length ? { urls } : {}),
      channel: CHANNEL[reading.kind],
      locale,
    },
    screenshot: {
      messageKind: reading.kind === "none" ? "other" : reading.kind,
      body: defangLinks(reading.body),
      sender: sender ?? null,
      subject: reading.kind === "email" ? reading.subject : null,
      brands: reading.brands,
      hasQrCode: reading.hasQrCode || qr.length > 0,
      qrLinks: qr,
    },
  };
}
