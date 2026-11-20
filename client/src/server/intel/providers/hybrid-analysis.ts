/**
 * Hybrid Analysis (Falcon Sandbox) API v2. The official docs page is a JavaScript shell that
 * could not be read; facts below come from Hybrid Analysis's own client (github.com/hybrid-analysis/VxAPI):
 * - Base https://www.hybrid-analysis.com/api/v2, header `api-key` (no account id or secret is sent;
 *   HYBRID_ANALYSIS_ID is therefore unused), a User-Agent is sent, redirects are not followed.
 * - POST /quick-scan/url-for-analysis (form url, scan_type, no_share_third_party),
 *   GET /quick-scan/{id}, GET /report/{id}/summary.
 * - Error body JSON {message}; quota messages contain "Exceeded maximum API requests" or
 *   "Quota limit has been exceeded".
 * NOT confirmed: response field names. They are read defensively (id | sha256, finished,
 * verdict, threat_score, scanners[].status); anything unexpected becomes "unavailable",
 * never a verdict.
 */
import type { HaSummary, ProviderResult } from "../types";
import { asNum, asObj, asStr, ProviderHttpError, type FetchLike } from "./http";

const BASE = "https://www.hybrid-analysis.com/api/v2";

export function createHybridAnalysis(apiKey: string, fetchFn: FetchLike = fetch) {
  const headers = { "api-key": apiKey, "User-Agent": "Mburoja Connector", Accept: "application/json" };

  async function call(path: string, init: RequestInit & { signal: AbortSignal }) {
    const res = await fetchFn(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, redirect: "manual" });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const msg = asStr(asObj(json).message) ?? "";
    if (res.status === 429 || /Exceeded maximum API requests|Quota limit has been exceeded/.test(msg)) throw new ProviderHttpError(429, "quota");
    if (!res.ok) throw new ProviderHttpError(res.status, `HTTP ${res.status}`);
    if (json === null) throw new ProviderHttpError(502, "malformed response");
    return asObj(json);
  }

  async function submitUrl(url: string, signal: AbortSignal): Promise<string> {
    const json = await call("/quick-scan/url-for-analysis", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ url, scan_type: "all", no_share_third_party: "1" }).toString(), signal });
    const id = asStr(json.id) ?? asStr(json.sha256);
    if (!id) throw new ProviderHttpError(502, "malformed response");
    return id;
  }

  /** null while the scan is still running. */
  async function poll(id: string, signal: AbortSignal): Promise<ProviderResult | null> {
    const json = await call(`/quick-scan/${encodeURIComponent(id)}`, { method: "GET", signal });
    if (json.finished === false) return null;
    const scanners = Array.isArray(json.scanners) ? json.scanners.map(asObj) : [];
    const statuses = scanners.map((s) => (asStr(s.status) ?? "").toLowerCase());
    const verdictRaw = (asStr(json.verdict) ?? "").toLowerCase();
    const threatScore = asNum(json.threat_score);
    if (json.finished !== true && !verdictRaw && threatScore === undefined && !statuses.length) throw new ProviderHttpError(502, "malformed response");
    const malicious = verdictRaw === "malicious" || (threatScore ?? 0) >= 70 || statuses.includes("malicious");
    const suspicious = !malicious && (verdictRaw === "suspicious" || statuses.includes("suspicious"));
    const s: HaSummary = { verdict: verdictRaw || undefined, threatScore, state: asStr(json.state) };
    return {
      provider: "hybrid_analysis",
      status: "done",
      verdict: malicious ? "malicious" : suspicious ? "suspicious" : statuses.length || verdictRaw ? "clean" : "unknown",
      maliciousCount: statuses.filter((x) => x === "malicious").length || undefined,
      totalCount: statuses.length || undefined,
      summary: { ...s },
      reportUrl: `https://www.hybrid-analysis.com/sample/${encodeURIComponent(id)}`,
    };
  }

  return { submitUrl, poll };
}
