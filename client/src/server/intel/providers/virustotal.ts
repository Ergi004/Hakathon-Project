/**
 * VirusTotal API v3 — confirmed from docs.virustotal.com (domain-info, domains-relationships,
 * scan-url, analysis, public-vs-premium-api, errors, domains-object):
 * - Base https://www.virustotal.com/api/v3, header `x-apikey`.
 * - GET /domains/{domain}: data.attributes.last_analysis_stats {harmless, malicious, suspicious,
 *   timeout, undetected}; creation_date (whois, Unix seconds); categories {service: label}; registrar.
 * - GET /domains/{domain}/subdomains?limit=&cursor= returns Domain objects (id = domain name).
 *   Response shape not shown in the docs: parsed defensively (data[].id).
 * - POST /urls (form `url`) returns an Analysis id (parsed defensively: data.id).
 * - GET /analyses/{id}: data.attributes.status queued | in-progress | completed, stats in data.attributes.stats.
 * - Public API: 4 requests/minute, 500/day. Errors {error:{code,message}}; 429 QuotaExceededError,
 *   404 NotFoundError. Queried IoCs become visible to the VT community: only sanitised URLs are sent.
 * - GUI links (https://www.virustotal.com/gui/domain/{d}) are not in the docs; widely used format.
 */
import type { ProviderResult, VtDomainSummary } from "../types";
import { asNum, asObj, asStr, failureReason, getJson, ProviderHttpError, type FetchLike } from "./http";

const BASE = "https://www.virustotal.com/api/v3";

function verdictFromStats(m: number, s: number, total: number): ProviderResult["verdict"] {
  if (m >= 3) return "malicious";
  if (m >= 1 || s >= 2) return "suspicious";
  return total > 0 ? "clean" : "unknown";
}

export function createVirusTotal(apiKey: string, fetchFn: FetchLike = fetch) {
  const headers = { "x-apikey": apiKey, Accept: "application/json" };

  async function domainReport(domain: string, signal: AbortSignal): Promise<ProviderResult> {
    try {
      const json = asObj(await getJson(fetchFn, `${BASE}/domains/${encodeURIComponent(domain)}`, { headers, signal }));
      const attr = asObj(asObj(json.data).attributes);
      const st = asObj(attr.last_analysis_stats);
      if (!Object.keys(st).length) return { provider: "virustotal", status: "unavailable", verdict: "unknown", summary: {}, error: "malformed" };
      const s: VtDomainSummary = {
        malicious: asNum(st.malicious) ?? 0,
        suspicious: asNum(st.suspicious) ?? 0,
        harmless: asNum(st.harmless) ?? 0,
        undetected: asNum(st.undetected) ?? 0,
        creationDate: asNum(attr.creation_date) ? new Date(asNum(attr.creation_date)! * 1000).toISOString().slice(0, 10) : undefined,
        registrar: asStr(attr.registrar),
        categories: [...new Set(Object.values(asObj(attr.categories)).filter((x): x is string => typeof x === "string"))].slice(0, 6),
      };
      const total = s.malicious + s.suspicious + s.harmless + s.undetected;
      return { provider: "virustotal", status: "done", verdict: verdictFromStats(s.malicious, s.suspicious, total), maliciousCount: s.malicious, totalCount: total, summary: { ...s }, reportUrl: `https://www.virustotal.com/gui/domain/${domain}` };
    } catch (e) {
      if (e instanceof ProviderHttpError && e.status === 404) return { provider: "virustotal", status: "done", verdict: "unknown", summary: { notFound: true } };
      return { provider: "virustotal", status: "unavailable", verdict: "unknown", summary: {}, error: failureReason(e) };
    }
  }

  async function subdomains(domain: string, signal: AbortSignal, limit = 40): Promise<string[]> {
    try {
      const json = asObj(await getJson(fetchFn, `${BASE}/domains/${encodeURIComponent(domain)}/subdomains?limit=${limit}`, { headers, signal }));
      const data = Array.isArray(json.data) ? json.data : [];
      return data.map((d) => asStr(asObj(d).id)).filter((x): x is string => !!x);
    } catch {
      return [];
    }
  }

  /** Tier B: submit the sanitised URL; returns the analysis id. */
  async function submitUrl(url: string, signal: AbortSignal): Promise<string> {
    const res = await fetchFn(`${BASE}/urls`, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ url }).toString(), signal });
    if (!res.ok) throw new ProviderHttpError(res.status, `HTTP ${res.status}`);
    const id = asStr(asObj(asObj(await res.json().catch(() => ({}))).data).id);
    if (!id) throw new ProviderHttpError(502, "malformed response");
    return id;
  }

  /** Tier B poll: null while queued / in-progress. */
  async function pollAnalysis(id: string, signal: AbortSignal): Promise<ProviderResult | null> {
    const json = asObj(await getJson(fetchFn, `${BASE}/analyses/${encodeURIComponent(id)}`, { headers, signal }));
    const attr = asObj(asObj(json.data).attributes);
    const status = asStr(attr.status);
    if (status !== "completed") {
      if (status === "queued" || status === "in-progress") return null;
      throw new ProviderHttpError(502, "malformed response");
    }
    const st = asObj(attr.stats);
    const m = asNum(st.malicious) ?? 0;
    const s = asNum(st.suspicious) ?? 0;
    const total = ["harmless", "malicious", "suspicious", "undetected", "timeout"].reduce((a, k) => a + (asNum(st[k]) ?? 0), 0);
    return { provider: "virustotal", status: "done", verdict: verdictFromStats(m, s, total), maliciousCount: m, totalCount: total, summary: { malicious: m, suspicious: s, deep: true } };
  }

  return { domainReport, subdomains, submitUrl, pollAnalysis };
}
