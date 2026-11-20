import { hostOf, refang } from "@/server/detection/normalize";
import type { Finding } from "../../types";

/**
 * Static, regex-based HTML inspection. The HTML is never rendered or executed
 * and no linked resource is fetched (hard rule 6, PDF §12).
 */
const MAX_HTML = 500_000;

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) % 0x110000))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16) % 0x110000))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .slice(0, MAX_HTML)
      .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export interface HtmlAnalysis {
  hrefs: { href: string; display: string }[];
  findings: Finding[];
  text: string;
}

export function analyzeHtml(html: string): HtmlAnalysis {
  const src = html.slice(0, MAX_HTML);
  const findings: Finding[] = [];
  const hrefs: { href: string; display: string }[] = [];

  for (const m of src.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1];
    const href = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const value = decodeEntities((href?.[1] ?? href?.[2] ?? href?.[3] ?? "").trim());
    if (!value || /^(mailto:|tel:|#|javascript:void)/i.test(value)) continue;
    const display = htmlToText(m[2]).slice(0, 300);
    hrefs.push({ href: value, display });
    if (hrefs.length >= 200) break;
  }

  // Display text that looks like a link but points elsewhere.
  for (const { href, display } of hrefs) {
    const shownHost = /[a-z0-9-]+\.[a-z]{2,}/i.test(display) ? hostOf(display) : null;
    const realHost = hostOf(href);
    if (shownHost && realHost && shownHost !== realHost && !realHost.endsWith(`.${shownHost}`)) {
      findings.push({ code: "link_text_mismatch", detail: `Link text shows ${shownHost} but points to ${realHost}`, evidence: realHost, weight: 12 });
      break;
    }
  }
  if (/^javascript:/im.test(hrefs.map((h) => h.href).join("\n"))) {
    findings.push({ code: "javascript_link", detail: "A link runs JavaScript instead of opening a page", weight: 8 });
  }

  const form = src.match(/<form\b[^>]*action\s*=\s*["']?([^"'\s>]+)/i);
  if (form) findings.push({ code: "html_form", detail: "The email contains a form that submits data", evidence: hostOf(refang(form[1])) ?? undefined, weight: 10 });
  if (/<input\b[^>]*type\s*=\s*["']?password/i.test(src)) {
    findings.push({ code: "password_field", detail: "The email contains a password field", weight: 15 });
  }
  if (/<script\b/i.test(src)) findings.push({ code: "html_script", detail: "The email contains script code", weight: 6 });
  if (/<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(src)) findings.push({ code: "meta_refresh", detail: "The email tries to redirect automatically", weight: 6 });
  if (/data:text\/html|data:application\/(x-)?javascript/i.test(src)) findings.push({ code: "data_uri_html", detail: "The email embeds an HTML or script data URI", weight: 8 });
  const entityCount = (src.match(/&#x?[0-9a-f]+;/gi) ?? []).length;
  if (entityCount > 80) findings.push({ code: "html_obfuscation", detail: `Heavy character-entity encoding (${entityCount} entities)`, weight: 5 });
  if (/display\s*:\s*none|font-size\s*:\s*0|visibility\s*:\s*hidden/i.test(src) && /<a\b/i.test(src)) {
    findings.push({ code: "hidden_content", detail: "The email hides part of its content from the reader", weight: 4 });
  }

  return { hrefs, findings, text: htmlToText(src) };
}
