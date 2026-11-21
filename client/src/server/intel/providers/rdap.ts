/**
 * RDAP — confirmed from about.rdap.org, data.iana.org/rdap/dns.json and RFC 9083:
 * - IANA bootstrap: services = [[tlds...], [base urls ending in "/"]]; query <base>domain/<name>.
 * - Fallback https://rdap.org/domain/<name> redirects (302) to the authoritative server; 404 = no RDAP
 *   service; Cloudflare limits 10 requests / 10 s (429).
 * - events[] {eventAction: "registration" | "expiration" | "last changed", eventDate RFC 3339}.
 * - Registrar: entities[] with roles ["registrar"], vcardArray ["vcard", [["fn", {}, "text", name], ...]].
 * - Media type application/rdap+json.
 */
import type { ProviderResult, RdapSummary } from "../types";
import { asObj, asStr, failureReason, getJson, ProviderHttpError, type FetchLike } from "./http";

let bootstrap: { at: number; map: Map<string, string> } | null = null;

async function baseFor(tld: string, fetchFn: FetchLike, signal: AbortSignal): Promise<string | null> {
  if (!bootstrap || Date.now() - bootstrap.at > 24 * 3_600_000) {
    try {
      const json = asObj(await getJson(fetchFn, "https://data.iana.org/rdap/dns.json", { signal, headers: { Accept: "application/json" } }));
      const map = new Map<string, string>();
      for (const svc of Array.isArray(json.services) ? json.services : []) {
        if (!Array.isArray(svc) || !Array.isArray(svc[0]) || !Array.isArray(svc[1])) continue;
        const url = (svc[1] as unknown[]).find((u): u is string => typeof u === "string" && u.startsWith("https://")) ?? (svc[1] as unknown[]).find((u): u is string => typeof u === "string");
        if (url) for (const t of svc[0] as unknown[]) if (typeof t === "string") map.set(t.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
      }
      bootstrap = { at: Date.now(), map };
    } catch {
      return null;
    }
  }
  return bootstrap.map.get(tld) ?? null;
}

export function parseRdap(json: unknown): RdapSummary {
  const o = asObj(json);
  const events = Array.isArray(o.events) ? o.events.map(asObj) : [];
  const ev = (a: string) => asStr(events.find((e) => asStr(e.eventAction)?.toLowerCase() === a)?.eventDate);
  const entities = Array.isArray(o.entities) ? o.entities.map(asObj) : [];
  const fn = (ent: Record<string, unknown>) => {
    const card = Array.isArray(ent.vcardArray) ? (ent.vcardArray[1] as unknown) : null;
    const prop = Array.isArray(card) ? (card as unknown[]).find((p) => Array.isArray(p) && p[0] === "fn") : null;
    return Array.isArray(prop) ? asStr(prop[3]) : undefined;
  };
  const registrar = entities.find((e) => Array.isArray(e.roles) && (e.roles as unknown[]).includes("registrar"));
  const registrant = entities.find((e) => Array.isArray(e.roles) && (e.roles as unknown[]).includes("registrant"));
  const remarks = JSON.stringify([o.remarks, registrant?.remarks, registrant ? fn(registrant) : ""]).toLowerCase();
  return {
    registeredAt: ev("registration")?.slice(0, 10),
    expiresAt: ev("expiration")?.slice(0, 10),
    registrar: registrar ? fn(registrar) : undefined,
    privacy: /redact|privacy|withheld|not disclosed|proxy/.test(remarks) || undefined,
  };
}

export function createRdap(fetchFn: FetchLike = fetch) {
  async function domain(name: string, signal: AbortSignal): Promise<ProviderResult> {
    try {
      const tld = name.split(".").pop() ?? "";
      const base = await baseFor(tld, fetchFn, signal);
      const url = base ? `${base}domain/${encodeURIComponent(name)}` : `https://rdap.org/domain/${encodeURIComponent(name)}`;
      const s = parseRdap(await getJson(fetchFn, url, { signal, headers: { Accept: "application/rdap+json" } }));
      return { provider: "rdap", status: "done", verdict: "unknown", summary: { ...s } };
    } catch (e) {
      if (e instanceof ProviderHttpError && e.status === 404) return { provider: "rdap", status: "done", verdict: "unknown", summary: { notFound: true } };
      return { provider: "rdap", status: "unavailable", verdict: "unknown", summary: {}, error: failureReason(e) };
    }
  }
  return { domain };
}
