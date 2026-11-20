import { z } from "zod";

/**
 * urlscan.io API v1 client (https://urlscan.io/docs/api/). urlscan opens the
 * page in its own browser; this platform only sends the (sanitised) URL and
 * reads back the result, DOM and recorded responses. Pure: fetch is injectable.
 */

export class UrlscanError extends Error {
  constructor(
    readonly code: "not_configured" | "unauthorized" | "quota" | "rejected" | "timeout" | "upstream" | "bad_response",
    message: string,
  ) {
    super(message);
    this.name = "UrlscanError";
  }
}

export interface UrlscanOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const submitSchema = z.object({ uuid: z.string(), result: z.string().optional(), api: z.string().optional(), visibility: z.string().optional() }).loose();

const requestSchema = z
  .object({
    request: z
      .object({
        type: z.string().optional(),
        documentURL: z.string().optional(),
        redirectResponse: z.unknown().optional(),
        request: z.object({ url: z.string(), method: z.string().optional(), postData: z.string().optional() }).loose(),
      })
      .loose(),
    response: z
      .object({
        hash: z.string().optional(),
        dataLength: z.number().optional(),
        response: z.object({ status: z.number().optional(), mimeType: z.string().optional(), url: z.string().optional() }).loose().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

/** Only the fields we use; everything else is tolerated (urlscan adds fields over time). */
export const resultSchema = z
  .object({
    task: z.object({ uuid: z.string(), url: z.string().optional(), visibility: z.string().optional(), screenshotURL: z.string().optional(), reportURL: z.string().optional() }).loose(),
    page: z
      .object({
        url: z.string().optional(),
        domain: z.string().optional(),
        ip: z.string().optional(),
        asn: z.string().optional(),
        asnname: z.string().optional(),
        country: z.string().optional(),
        server: z.string().optional(),
        title: z.string().optional(),
        status: z.union([z.string(), z.number()]).optional(),
        tlsIssuer: z.string().optional(),
        tlsValidDays: z.number().optional(),
        domainAgeDays: z.number().optional(),
        apexDomain: z.string().optional(),
      })
      .loose()
      .default({}),
    data: z.object({ requests: z.array(requestSchema).default([]) }).loose().default({ requests: [] }),
    lists: z.object({ domains: z.array(z.string()).default([]), urls: z.array(z.string()).default([]), ips: z.array(z.string()).default([]) }).loose().default({ domains: [], urls: [], ips: [] }),
    verdicts: z
      .object({
        overall: z
          .object({ score: z.number().optional(), malicious: z.boolean().optional(), categories: z.array(z.string()).optional(), brands: z.array(z.string()).optional(), tags: z.array(z.string()).optional() })
          .loose()
          .optional(),
      })
      .loose()
      .default({}),
  })
  .loose();
export type UrlscanResult = z.infer<typeof resultSchema>;

export function createUrlscanClient(opts: UrlscanOptions) {
  const base = (opts.baseUrl ?? "https://urlscan.io").replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    if (!opts.apiKey) throw new UrlscanError("not_configured", "URLSCAN_API_KEY is not set");
    try {
      return await doFetch(`${base}${path}`, {
        ...init,
        headers: { "API-Key": opts.apiKey, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (e) {
      throw new UrlscanError("timeout", e instanceof Error ? e.message : "network error");
    }
  }

  const fail = async (res: Response): Promise<never> => {
    const body = (await res.json().catch(() => null)) as { message?: string; description?: string } | null;
    const msg = body?.description || body?.message || `urlscan ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new UrlscanError("unauthorized", msg);
    if (res.status === 429) throw new UrlscanError("quota", msg);
    if (res.status === 400) throw new UrlscanError("rejected", msg);
    throw new UrlscanError("upstream", msg);
  };

  return {
    configured: Boolean(opts.apiKey),

    /** POST /api/v1/scan/ — queue a scan. */
    async submit(url: string, o: { visibility: "public" | "unlisted" | "private"; tags?: string[]; country?: string }) {
      const res = await call("/api/v1/scan/", {
        method: "POST",
        body: JSON.stringify({ url, visibility: o.visibility, tags: o.tags ?? [], ...(o.country ? { country: o.country } : {}) }),
      });
      if (!res.ok) return fail(res);
      const parsed = submitSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new UrlscanError("bad_response", "Unexpected submit response");
      return { uuid: parsed.data.uuid, resultUrl: parsed.data.result ?? `${base}/result/${parsed.data.uuid}/`, visibility: parsed.data.visibility ?? o.visibility };
    },

    /** GET /api/v1/result/{uuid}/ — null while the scan is still running (404). */
    async result(uuid: string): Promise<UrlscanResult | null> {
      const res = await call(`/api/v1/result/${encodeURIComponent(uuid)}/`);
      if (res.status === 404) return null;
      if (res.status === 410) throw new UrlscanError("rejected", "Scan was deleted");
      if (!res.ok) return fail(res);
      const parsed = resultSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new UrlscanError("bad_response", "Unexpected result shape");
      return parsed.data;
    },

    /** GET /dom/{uuid}/ — the rendered DOM as text (never executed here). */
    async dom(uuid: string, maxBytes = 2_000_000): Promise<string | null> {
      const res = await call(`/dom/${encodeURIComponent(uuid)}/`);
      if (!res.ok) return null;
      return (await res.text()).slice(0, maxBytes);
    },

    /** GET /responses/{sha256}/ — a recorded response body (scripts), read as text. */
    async response(hash: string, maxBytes = 600_000): Promise<string | null> {
      if (!/^[a-f0-9]{64}$/.test(hash)) return null;
      const res = await call(`/responses/${hash}/`);
      if (!res.ok) return null;
      return (await res.text()).slice(0, maxBytes);
    },
  };
}

export type UrlscanClient = ReturnType<typeof createUrlscanClient>;
