/**
 * abuse.ch URLhaus — confirmed from https://urlhaus-api.abuse.ch/:
 * - Base https://urlhaus-api.abuse.ch/v1/, header `Auth-Key` (mandatory, from auth.abuse.ch).
 * - POST /host/ (form `host`): query_status ok | no_results | invalid_host | http_post_expected;
 *   fields urlhaus_reference, firstseen, url_count (may be a string), blacklists {surbl, spamhaus_dbl}, urls[] (≤100)
 *   with url_status, threat, tags, date_added.
 * - POST /url/ (form `url`): query_status ok | no_results | invalid_url; url_status online | offline | unknown.
 * - No numeric rate limit published (fair use).
 */
import type { ProviderResult, UrlhausSummary } from "../types";
import { asNum, asObj, asStr, failureReason, getJson, type FetchLike } from "./http";

const BASE = "https://urlhaus-api.abuse.ch/v1";

export function createUrlhaus(authKey: string, fetchFn: FetchLike = fetch) {
  async function host(h: string, signal: AbortSignal): Promise<ProviderResult> {
    try {
      const json = asObj(
        await getJson(fetchFn, `${BASE}/host/`, {
          method: "POST",
          headers: { "Auth-Key": authKey, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({ host: h }).toString(),
          signal,
        }),
      );
      const qs = asStr(json.query_status) ?? asStr(json.query_staus);
      if (qs === "no_results") return { provider: "urlhaus", status: "done", verdict: "clean", summary: { listed: false, urlCount: 0, threats: [], blacklists: {} } satisfies UrlhausSummary };
      if (qs !== "ok") return { provider: "urlhaus", status: "unavailable", verdict: "unknown", summary: {}, error: qs ?? "malformed" };
      const urls = Array.isArray(json.urls) ? json.urls.map(asObj) : [];
      const bl = asObj(json.blacklists);
      const listedBl = Object.fromEntries(Object.entries(bl).filter(([, v]) => typeof v === "string" && v !== "not listed")) as Record<string, string>;
      const s: UrlhausSummary = {
        listed: true,
        urlCount: asNum(json.url_count) ?? urls.length,
        threats: [...new Set(urls.map((u) => asStr(u.threat)).filter((x): x is string => !!x))],
        firstSeen: asStr(json.firstseen)?.slice(0, 10),
        blacklists: listedBl,
      };
      return { provider: "urlhaus", status: "done", verdict: "malicious", maliciousCount: s.urlCount, summary: { ...s }, reportUrl: asStr(json.urlhaus_reference) };
    } catch (e) {
      return { provider: "urlhaus", status: "unavailable", verdict: "unknown", summary: {}, error: failureReason(e) };
    }
  }
  return { host };
}
