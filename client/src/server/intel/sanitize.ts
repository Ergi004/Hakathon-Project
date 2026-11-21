import { isIP } from "node:net";
import { parse } from "tldts";
import { refang } from "@/server/detection/normalize";

export type Eligibility =
  | { ok: true; url: string; host: string; registrableDomain: string; synthetic: boolean }
  | { ok: false; reason: "invalid" | "scheme" | "private" | "official" | "allowlisted" | "synthetic" };

const PERSONAL_PATH = /\d{6,}|[^/@\s]+@[^/\s]+|%40/;

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const ip = host.replace(/^\[|\]$/g, "");
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (v === 6) return ip === "::1" || ip === "::" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
  return false;
}

export function isSynthetic(host: string): boolean {
  return host.endsWith(".example") || host.endsWith(".test") || host === "example" || host === "test";
}

/** Registrable domain; synthetic suffixes are kept (pogradec.gov.al.example → gov.al.example base handled by tldts on the stripped part). */
export function registrableDomain(host: string): string {
  const suffix = host.endsWith(".example") ? ".example" : host.endsWith(".test") ? ".test" : "";
  const base = suffix ? host.slice(0, -suffix.length) : host;
  const p = parse(base, { allowPrivateDomains: false });
  return `${p.domain ?? base}${suffix}`;
}

/**
 * Only scheme://host/path is ever sent to a provider: no userinfo, query or
 * fragment, and host only when the path looks personal. Only http(s). Private
 * addresses, official and allowlisted domains are never submitted.
 */
export function sanitizeForIntel(
  input: string,
  opts: { officialDomains?: Iterable<string>; allowlisted?: Iterable<string>; mode?: "mock" | "live" } = {},
): Eligibility {
  let u: URL;
  try {
    const value = refang(input.trim());
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, reason: "scheme" };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, reason: "invalid" };
  if (isPrivateHost(host)) return { ok: false, reason: "private" };
  if (!host.includes(".") && !isIP(host.replace(/^\[|\]$/g, ""))) return { ok: false, reason: "invalid" };
  for (const d of opts.officialDomains ?? []) if (host === d || host.endsWith(`.${d}`)) return { ok: false, reason: "official" };
  for (const d of opts.allowlisted ?? []) if (host === d || host.endsWith(`.${d}`)) return { ok: false, reason: "allowlisted" };
  const synthetic = isSynthetic(host);
  if (synthetic && opts.mode === "live") return { ok: false, reason: "synthetic" };
  const path = decodeURIComponentSafe(u.pathname);
  const safePath = PERSONAL_PATH.test(path) ? "/" : u.pathname || "/";
  return { ok: true, url: `${u.protocol}//${host}${u.port ? `:${u.port}` : ""}${safePath}`, host, registrableDomain: registrableDomain(host), synthetic };
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
