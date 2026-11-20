/** Small fetch helper shared by adapters. Errors become typed failures the adapters turn into "unavailable". */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ProviderHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getJson(fetchFn: FetchLike, url: string, init: RequestInit & { signal: AbortSignal }): Promise<unknown> {
  const res = await fetchFn(url, { ...init, redirect: init.redirect ?? "follow" });
  if (!res.ok) throw new ProviderHttpError(res.status, `HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > 5_000_000) throw new ProviderHttpError(502, "response too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderHttpError(502, "malformed response");
  }
}

export function failureReason(e: unknown): string {
  if (e instanceof ProviderHttpError) return e.status === 429 ? "quota" : e.status === 401 || e.status === 403 ? "auth" : e.message === "malformed response" ? "malformed" : `http_${e.status}`;
  if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) return "timeout";
  return "error";
}

export const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const asNum = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
export const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
