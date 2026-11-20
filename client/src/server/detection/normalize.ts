import { domainToUnicode } from "node:url";

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;

/** NFKC, strip zero-width characters, collapse whitespace. */
export function normalizeText(input: string): string {
  return input.normalize("NFKC").replace(ZERO_WIDTH, "").replace(/\s+/g, " ").trim();
}

/** Lower-case and remove diacritics (ë→e, ç→c) for keyword matching. */
export function foldText(input: string): string {
  return normalizeText(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** hxxp://, [.], (.), [:], [at] → canonical form. */
export function refang(input: string): string {
  return input
    .trim()
    .replace(/^hxxp(s?):\/\//i, "http$1://")
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]|\(dot\)/gi, ".")
    .replace(/\[:\]/g, ":")
    .replace(/\[at\]|\(at\)|\[@\]/gi, "@")
    .replace(/\[\/\]/g, "/");
}

/** Defang a URL or domain for display and storage: hxxp:// and [.] in the host. */
export function defang(input: string): string {
  const value = refang(input);
  const m = value.match(/^([a-z][a-z0-9+.-]*:\/\/)?([^/?#\s]+)(.*)$/i);
  if (!m) return value.replace(/\./g, "[.]");
  const scheme = (m[1] ?? "").replace(/^http/i, "hxxp");
  return `${scheme}${m[2].replace(/\./g, "[.]")}${m[3]}`;
}

/** Hostname of a URL or bare domain, lower-case ASCII (punycode), without www. */
export function hostOf(input: string): string | null {
  const value = refang(input);
  if (!value) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`;
    const host = new URL(withScheme).hostname.replace(/\.$/, "").replace(/^www\./, "");
    if (!host.includes(".")) return null;
    return host.toLowerCase();
  } catch {
    return null;
  }
}

/** Punycode-decoded hostname (pogradеc with a Cyrillic е stays visible as such). */
export function hostToUnicode(host: string): string {
  return domainToUnicode(host) || host;
}

export const SYNTHETIC_SUFFIXES = [".example", ".test"] as const;

/** The dataset uses .example/.test suffixes; strip them before public-suffix parsing. */
export function stripSynthetic(host: string): { base: string; suffix: string } {
  for (const s of SYNTHETIC_SUFFIXES) {
    if (host.endsWith(s)) return { base: host.slice(0, -s.length), suffix: s };
  }
  return { base: host, suffix: "" };
}

const URL_RE =
  /\b(?:(?:https?|hxxps?):\/\/|www(?:\.|\[\.\]))[^\s<>"'()]+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.|\[\.\]|\(\.\)))+(?:xn--[a-z0-9-]+|[a-z]{2,24})(?:\/[^\s<>"']*)?/gi;

/** URLs and bare domains in free text, refanged and de-duplicated. */
export function extractUrls(text: string): string[] {
  const out = new Set<string>();
  const normalized = normalizeText(text);
  for (const match of normalized.matchAll(URL_RE)) {
    // Part of an email address ("ana.hoxha@gmail.com" → "ana.hoxha" / "gmail.com"), not a link:
    // treating the local part as a domain would leak personal names into indicators.
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const head = normalized.slice(Math.max(0, start - 4), start).toLowerCase();
    const tail = normalized.slice(end, end + 4).toLowerCase();
    if (head.endsWith("@") || head === "[at]" || tail.startsWith("@") || tail === "[at]") continue;
    const raw = match[0].replace(/[.,;:!?)\]]+$/, "");
    const value = refang(raw);
    // Ignore things like "p.sh." or file names without a real host.
    if (!hostOf(value)) continue;
    if (/^[^/]*@/.test(value)) continue;
    out.add(value);
  }
  return [...out];
}

const EMAIL_RE = /\b[a-z0-9._%+-]+(?:@|\[at\]|\(at\))[a-z0-9.-]+(?:\.|\[\.\])[a-z]{2,24}\b/gi;
export function extractEmails(text: string): string[] {
  return [...new Set([...text.matchAll(EMAIL_RE)].map((m) => refang(m[0]).toLowerCase()))];
}

const PHONE_RE = /(?:\+|00)?355[\s.-]?\d(?:[\s.-]?\d){7,8}\b|\b06\d(?:[\s.-]?\d){6,7}\b|\b0\d{1,2}(?:[\s.-]?\d){6,7}\b/g;
export function extractPhones(text: string): string[] {
  return [...new Set([...text.matchAll(PHONE_RE)].map((m) => normalizePhone(m[0])))];
}

/** Canonical Albanian phone: +355XXXXXXXXX. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+355")) return digits;
  if (digits.startsWith("00355")) return `+${digits.slice(2)}`;
  if (digits.startsWith("355")) return `+${digits}`;
  if (digits.startsWith("0")) return `+355${digits.slice(1)}`;
  return digits;
}

/** "Name <addr@domain>" → parts. */
export function parseSender(sender: string): { display: string; address: string | null; domain: string | null } {
  const value = refang(sender).trim();
  const angle = value.match(/^(.*?)<\s*([^>]+)\s*>$/);
  const address = (angle ? angle[2] : value).trim().toLowerCase();
  const display = (angle ? angle[1] : "").trim().replace(/^["']|["']$/g, "").trim();
  if (!address.includes("@")) return { display: display || value, address: null, domain: null };
  return { display, address, domain: address.split("@")[1] ?? null };
}
