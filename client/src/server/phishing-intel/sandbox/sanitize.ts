import { refang } from "@/server/detection/normalize";

/**
 * Before a phishing URL goes to a third-party sandbox, remove the victim's
 * identity from it. Kits personalise links (`?email=ana@…`, `#YW5hQGdtYWlsLmNvbQ==`,
 * `/u/ana%40firma.al`); sending those to urlscan.io would disclose who was targeted.
 * Placeholders keep the kit working (it still sees "an email") without the person.
 * Pure. Returns the kinds replaced (never the values).
 */

export const PLACEHOLDER_EMAIL = "user@example.com";
const PLACEHOLDER_PHONE = "+355600000000";
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const EMAIL_PCT = /[a-z0-9._%+-]+%40[a-z0-9.-]+\.[a-z]{2,24}/gi;
const PHONE = /(?:\+|%2B|00)?355[\s.-]?6\d(?:[\s.-]?\d){7}/gi;
const B64_TOKEN = /[A-Za-z0-9_-]{12,}={0,2}|[A-Za-z0-9+/]{12,}={0,2}/g;

export type SanitizedKind = "email" | "email_encoded" | "email_base64" | "phone" | "credentials";

function decodeB64(token: string): string | null {
  try {
    const out = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return /^[\x20-\x7e]+$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

function encodeLike(token: string, value: string): string {
  const b = Buffer.from(value, "utf8").toString("base64");
  const urlSafe = /[-_]/.test(token) || !/[+/]/.test(token);
  const body = urlSafe ? b.replace(/\+/g, "-").replace(/\//g, "_") : b;
  return token.endsWith("=") ? body : body.replace(/=+$/, "");
}

export function sanitizeForSandbox(input: string): { url: string; replaced: SanitizedKind[] } | null {
  const replaced = new Set<SanitizedKind>();
  let u: URL;
  try {
    u = new URL(refang(input.trim()));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (u.username || u.password) {
    u.username = "";
    u.password = "";
    replaced.add("credentials");
  }

  const scrub = (part: string): string => {
    let out = part.replace(EMAIL_PCT, () => (replaced.add("email_encoded"), encodeURIComponent(PLACEHOLDER_EMAIL)));
    out = out.replace(EMAIL, () => (replaced.add("email"), PLACEHOLDER_EMAIL));
    out = out.replace(PHONE, () => (replaced.add("phone"), PLACEHOLDER_PHONE));
    out = out.replace(B64_TOKEN, (token) => {
      const decoded = decodeB64(token);
      if (!decoded || !/@[a-z0-9.-]+\.[a-z]{2,}/i.test(decoded)) return token;
      replaced.add("email_base64");
      return encodeLike(token, decoded.replace(EMAIL, PLACEHOLDER_EMAIL));
    });
    return out;
  };

  const path = scrub(u.pathname);
  const search = scrub(u.search);
  const hash = scrub(u.hash);
  const out = `${u.protocol}//${u.host}${path}${search}${hash}`;
  return { url: out, replaced: [...replaced] };
}

/** De-duplication key: host + path, without query or fragment (they are per-victim). */
export function landingKey(url: string): string {
  const u = new URL(url);
  return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "") || "/"}`;
}
