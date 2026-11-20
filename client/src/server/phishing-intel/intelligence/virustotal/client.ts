import { z } from "zod";

/**
 * VirusTotal API v3 client: reputation LOOKUPS ONLY (GET). Nothing is ever
 * submitted for scanning (POST /urls is deliberately absent), so VirusTotal
 * never fetches a user-submitted URL on our behalf (hard rule 6). Server-side only:
 * the key never reaches the browser or the extension.
 * Docs: https://docs.virustotal.com/reference/overview
 */

export type VtKind = "url" | "domain" | "ip" | "file";

export class VtError extends Error {
  constructor(
    readonly code: "not_configured" | "unauthorized" | "quota" | "timeout" | "upstream" | "bad_response",
    message: string,
  ) {
    super(message);
    this.name = "VtError";
  }
}

const statsSchema = z.object({
  harmless: z.number().default(0),
  malicious: z.number().default(0),
  suspicious: z.number().default(0),
  undetected: z.number().default(0),
});

/** Provider responses are validated before use (PDF §3 "validate provider responses"). */
const attributesSchema = z
  .object({
    last_analysis_stats: statsSchema.optional(),
    reputation: z.number().optional(),
    categories: z.record(z.string(), z.string()).optional(),
    last_analysis_date: z.number().optional(),
    first_submission_date: z.number().optional(),
    creation_date: z.number().optional(),
    popular_threat_classification: z.object({ suggested_threat_label: z.string().optional() }).optional(),
  })
  .loose();

const responseSchema = z.object({ data: z.object({ id: z.string(), type: z.string(), attributes: attributesSchema }) });

export interface VtReport {
  found: boolean;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  reputation: number | null;
  threatLabel: string | null;
  categories: string[];
  firstSeen: string | null;
  lastAnalysisAt: string | null;
}

const NOT_FOUND: VtReport = {
  found: false,
  malicious: 0,
  suspicious: 0,
  harmless: 0,
  undetected: 0,
  reputation: null,
  threatLabel: null,
  categories: [],
  firstSeen: null,
  lastAnalysisAt: null,
};

/** URL identifier for GET /urls/{id}: unpadded base64url of the URL. */
export function urlId(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

export function pathFor(kind: VtKind, value: string): string {
  switch (kind) {
    case "url":
      return `/urls/${urlId(value)}`;
    case "domain":
      return `/domains/${encodeURIComponent(value)}`;
    case "ip":
      return `/ip_addresses/${encodeURIComponent(value)}`;
    case "file":
      return `/files/${encodeURIComponent(value)}`;
  }
}

const iso = (unix?: number) => (unix ? new Date(unix * 1000).toISOString() : null);

export interface VtClientOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function createVtClient(opts: VtClientOptions) {
  const base = (opts.baseUrl ?? "https://www.virustotal.com/api/v3").replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const timeoutMs = opts.timeoutMs ?? 8000;

  async function lookup(kind: VtKind, value: string): Promise<VtReport> {
    if (!opts.apiKey) throw new VtError("not_configured", "VirusTotal API key is not set");
    let lastError: VtError | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(800 * 2 ** (attempt - 1));
      let res: Response;
      try {
        res = await doFetch(`${base}${pathFor(kind, value)}`, {
          method: "GET",
          headers: { "x-apikey": opts.apiKey, accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (e) {
        lastError = new VtError("timeout", e instanceof Error ? e.message : "network error");
        continue;
      }
      if (res.status === 404) return { ...NOT_FOUND };
      if (res.status === 401 || res.status === 403) throw new VtError("unauthorized", `VirusTotal rejected the key (${res.status})`);
      if (res.status === 429) throw new VtError("quota", "VirusTotal quota exceeded");
      if (res.status >= 500) {
        lastError = new VtError("upstream", `VirusTotal ${res.status}`);
        continue;
      }
      if (!res.ok) throw new VtError("upstream", `VirusTotal ${res.status}`);
      const parsed = responseSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new VtError("bad_response", "Unexpected VirusTotal response shape");
      const a = parsed.data.data.attributes;
      const s = a.last_analysis_stats ?? { harmless: 0, malicious: 0, suspicious: 0, undetected: 0 };
      return {
        found: true,
        malicious: s.malicious,
        suspicious: s.suspicious,
        harmless: s.harmless,
        undetected: s.undetected,
        reputation: a.reputation ?? null,
        threatLabel: a.popular_threat_classification?.suggested_threat_label ?? null,
        categories: [...new Set(Object.values(a.categories ?? {}))].slice(0, 10),
        firstSeen: iso(a.first_submission_date ?? a.creation_date),
        lastAnalysisAt: iso(a.last_analysis_date),
      };
    }
    throw lastError ?? new VtError("upstream", "VirusTotal unavailable");
  }

  return { lookup, configured: Boolean(opts.apiKey) };
}

export type VtClient = ReturnType<typeof createVtClient>;

/** 0-100 contribution of one report (PDF §7.6 "VirusTotal reputation"). */
export function vtScore(r: Pick<VtReport, "found" | "malicious" | "suspicious">): number | null {
  if (!r.found) return null;
  if (r.malicious >= 5) return 100;
  if (r.malicious >= 2) return 80;
  if (r.malicious === 1) return 50;
  if (r.suspicious >= 2) return 40;
  if (r.suspicious === 1) return 25;
  return 0;
}
