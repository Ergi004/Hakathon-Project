import { defang, extractEmails, extractPhones, extractUrls, hostOf, parseSender, refang } from "@/server/detection/normalize";
import type { ExtractedIoc, IocLocation, IocType, ParsedMessage } from "../types";
import type { SmsSender } from "../channels/sms/sms-analyzer";

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const HASH = /\b(?:[a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})\b/gi;
const MAX_PER_TYPE = 100;

export function isIPv4(v: string): boolean {
  return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(v);
}

/** Private, loopback, link-local and reserved ranges are never looked up externally. */
export function isPrivateIPv4(v: string): boolean {
  const [a, b] = v.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/** Canonical URL for correlation: refanged, lower-case scheme and host, no fragment. */
export function normalizeUrl(raw: string): string | null {
  const v = refang(raw);
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `http://${v}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

class IocSet {
  private map = new Map<string, ExtractedIoc>();
  add(type: IocType, normalized: string | null | undefined, location: IocLocation, display?: string, extra?: Pick<ExtractedIoc, "subtype" | "detail">) {
    if (!normalized) return;
    const key = `${type}:${normalized}`;
    const prev = this.map.get(key);
    if (prev) {
      if (!prev.locations.includes(location)) prev.locations.push(location);
      return;
    }
    if ([...this.map.values()].filter((i) => i.type === type).length >= MAX_PER_TYPE) return;
    this.map.set(key, { type, normalized, display: display ?? normalized, locations: [location], ...extra });
  }
  list() {
    return [...this.map.values()];
  }
}

/** Extract, normalise and de-duplicate indicators with their source locations (PDF §7.2 steps 10-11). */
export function extractIocs(msg: ParsedMessage & { smsSender?: SmsSender }): ExtractedIoc[] {
  const set = new IocSet();
  const addUrl = (raw: string, loc: IocLocation) => {
    const url = normalizeUrl(raw);
    if (!url) return;
    set.add("url", url, loc, defang(url));
    const host = hostOf(url);
    if (!host) return;
    if (isIPv4(host)) set.add("ip", host, loc);
    else set.add("domain", host, loc, defang(host));
  };

  for (const u of extractUrls(msg.text)) addUrl(u, "body");
  if (msg.subject) for (const u of extractUrls(msg.subject)) addUrl(u, "subject");
  for (const h of msg.hrefs) addUrl(h.href, "html_href");

  for (const m of msg.text.matchAll(IPV4)) set.add("ip", m[0], "body");

  const addEmail = (raw: string | undefined, loc: IocLocation) => {
    if (!raw) return;
    const addr = parseSender(raw).address;
    if (!addr) return;
    set.add("email", addr, loc, defang(addr));
    const d = addr.split("@")[1];
    if (d) set.add("domain", d, loc, defang(d));
  };
  if (msg.channel === "email") addEmail(msg.sender, "sender");
  addEmail(msg.replyTo, "reply_to");
  addEmail(msg.returnPath, "return_path");
  for (const e of extractEmails(msg.text)) set.add("email", e, "body", defang(e));

  for (const p of extractPhones(msg.text)) set.add("phone_number", p, "body");
  if (msg.smsSender?.kind === "e164") set.add("phone_number", msg.smsSender.normalized, "sender");
  if (msg.smsSender?.kind === "short_code") set.add("short_code", msg.smsSender.normalized, "sender");

  for (const a of msg.attachments) if (a.sha256) set.add("file_hash", a.sha256.toLowerCase(), "attachment", `${a.sha256.toLowerCase()} (${a.name})`);
  for (const m of msg.text.matchAll(HASH)) set.add("file_hash", m[0].toLowerCase(), "body");

  // Where captured data goes. The endpoint itself is one indicator; its host (unless a shared
  // service like Telegram or Google) also becomes a domain/URL so VirusTotal checks it.
  for (const e of msg.exfil ?? []) {
    const loc: IocLocation = e.source === "attachment" ? "attachment" : "body";
    const detail: Record<string, string> = { source: e.source, via: e.via };
    if (e.origin) detail.origin = e.origin;
    if (e.method) detail.method = e.method;
    if (e.chatId) detail.chatId = e.chatId;
    if (e.secretHash) detail.secretHash = e.secretHash;
    set.add("exfil_endpoint", e.key, loc, e.display, { subtype: e.kind, detail });
    if (!e.host) continue;
    if (isIPv4(e.host)) {
      if (!isPrivateIPv4(e.host)) set.add("ip", e.host, loc);
    } else {
      set.add("domain", e.host, loc, defang(e.host));
    }
    const url = normalizeUrl(`https://${e.key.replace(/^url:/, "")}`);
    if (url) set.add("url", url, loc, defang(url));
  }

  return set.list();
}
