declare const __API_URL__: string;
declare const __VERSION__: string;

export const API_URL = __API_URL__;
export const VERSION = __VERSION__;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(0, "offline", "Platform not reachable");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "http_error", body?.error?.message ?? `HTTP ${res.status}`);
  return body as T;
}

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Anonymous install: a random id (hashed by the server) exchanged for an install token. */
async function register(): Promise<string> {
  let installHash = (await chrome.storage.local.get("installHash")).installHash as string | undefined;
  if (!installHash) {
    installHash = randomHex(32);
    await chrome.storage.local.set({ installHash });
  }
  const { installToken } = await call<{ installToken: string }>("/api/v1/extension/register", { method: "POST", body: JSON.stringify({ installHash, version: VERSION }) });
  await chrome.storage.local.set({ installToken });
  return installToken;
}

async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const stored = (await chrome.storage.local.get("installToken")).installToken;
  const installToken = typeof stored === "string" && stored ? stored : await register();
  try {
    return await call<T>(path, { ...init, token: installToken });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return call<T>(path, { ...init, token: await register() });
    throw e;
  }
}

export interface ScanResponse {
  score: number;
  flag: "green" | "yellow" | "orange" | "red" | "darkred" | "grey";
  reasons: { code: string; weight: number; group?: string; text_sq: string; text_en: string; evidence?: string }[];
  groups?: Record<string, number>;
  explanation?: string;
  checkId: string | null;
  scan: { scanId: string; token: string } | null;
  scans?: { scanId: string; token: string; host: string }[];
}

export interface IntelSnapshot {
  scan: { status: string; mock: boolean; finalScore: number | null; domainAgeDays: number | null; host: string; deep: boolean };
  results: { key: string; provider: string; tier: "A" | "B"; status: string; verdict: string; maliciousCount: number | null; totalCount: number | null; summary: Record<string, unknown> }[];
  subdomains: unknown[];
}

export const api = {
  scan: (input: unknown, opts: { deep: boolean }) => authed<ScanResponse>(`/api/v1/scan?liveScans=3${opts.deep ? "&deep=1" : ""}`, { method: "POST", body: JSON.stringify(input) }),
  intel: (scanId: string, token: string) => call<IntelSnapshot>(`/api/v1/scan/live/${encodeURIComponent(scanId)}?token=${encodeURIComponent(token)}`),
  report: (signals: unknown) => authed<{ reportId: string; protocol: string; deleteUntil: string }>("/api/v1/extension/reports", { method: "POST", body: JSON.stringify({ signals, consent: true }) }),
  undo: (reportId: string) => authed<void>(`/api/v1/extension/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" }),
};
