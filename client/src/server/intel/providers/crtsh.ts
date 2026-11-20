/**
 * crt.sh — no published API docs; confirmed from a live response of
 * https://crt.sh/?q=%25.example.org&output=json: a JSON array of
 * {issuer_ca_id, issuer_name, common_name, name_value, id, not_before, not_after, serial_number, result_count}.
 * name_value holds names separated by "\n" (wildcards and email SANs included); dates are
 * "YYYY-MM-DDTHH:MM:SS" without a timezone (treated as UTC). No documented rate limit: kept low.
 */
import type { CrtSummary, ProviderResult } from "../types";
import { asObj, asStr, failureReason, getJson, type FetchLike } from "./http";

export function parseCrt(json: unknown, domain: string): CrtSummary {
  const rows = Array.isArray(json) ? json.map(asObj) : [];
  const first = new Map<string, string>();
  for (const r of rows) {
    const nb = asStr(r.not_before)?.slice(0, 10);
    for (const raw of (asStr(r.name_value) ?? "").split("\n")) {
      const n = raw.trim().toLowerCase();
      if (!n || n.includes("@") || n.startsWith("*.") || n.includes("*")) continue;
      if (n !== domain && !n.endsWith(`.${domain}`)) continue;
      const prev = first.get(n);
      if (nb && (!prev || nb < prev)) first.set(n, nb);
      else if (!prev) first.set(n, nb ?? "");
    }
  }
  const dates = [...first.values()].filter(Boolean).sort();
  return { firstCertAt: dates[0], names: [...first.entries()].map(([name, firstSeen]) => ({ name, firstSeen: firstSeen || undefined })) };
}

export function createCrtsh(fetchFn: FetchLike = fetch) {
  async function domain(name: string, signal: AbortSignal): Promise<ProviderResult> {
    try {
      const s = parseCrt(await getJson(fetchFn, `https://crt.sh/?q=${encodeURIComponent(`%.${name}`)}&output=json`, { signal, headers: { Accept: "application/json" } }), name);
      return { provider: "crtsh", status: "done", verdict: "unknown", summary: { firstCertAt: s.firstCertAt, count: s.names.length, names: s.names.slice(0, 200) } };
    } catch (e) {
      return { provider: "crtsh", status: "unavailable", verdict: "unknown", summary: {}, error: failureReason(e) };
    }
  }
  return { domain };
}
