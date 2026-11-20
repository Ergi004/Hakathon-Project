import "server-only";

import { resolveTxt, lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { sha256 } from "./hash";

/** Token an organization must publish to prove it owns a domain (SPEC 9 B2). */
export function verificationToken(orgId: string, domain: string): string {
  return `mburoja-verify=${sha256(`${process.env.CRON_SECRET ?? "mburoja"}:${orgId}:${domain}`).slice(0, 32)}`;
}

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80") || ip === "::";
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/**
 * The only outbound check the platform makes (SPEC 15.1): the verified member's
 * own domain, 3 s timeout, no redirects, no private IPs, 4 KB cap. Never used for
 * user-submitted URLs.
 */
export async function verifyDomainOwnership(orgId: string, domain: string): Promise<boolean> {
  const token = verificationToken(orgId, domain);
  try {
    const records = await withTimeout(resolveTxt(domain), 3000);
    if (records.some((r) => r.join("").trim() === token)) return true;
  } catch {
    /* fall through to the file check */
  }
  try {
    const { address } = await withTimeout(lookup(domain), 3000);
    if (isPrivate(address)) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`https://${domain}/.well-known/mburoja.txt`, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "Mburoja-Verify/1.0" } });
    clearTimeout(timer);
    if (res.status !== 200) return false;
    const reader = res.body?.getReader();
    let text = "";
    while (reader && text.length < 4096) {
      const { done, value } = await reader.read();
      if (done) break;
      text += new TextDecoder().decode(value);
    }
    await reader?.cancel();
    return text.trim().slice(0, 4096).split(/\s+/).includes(token);
  } catch {
    return false;
  }
}
