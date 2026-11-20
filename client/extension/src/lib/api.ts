import type { ExtractedEmail, ScanPayload } from "./types";

/**
 * Talks to the existing platform API only (PDF §9.2): an install token from
 * /api/v1/extension/register, then /api/phishing-intelligence/*. No provider
 * key (VirusTotal, Gemini) ever lives in the extension.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(server: string, path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body) headers["content-type"] = "application/json";
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${server.replace(/\/$/, "")}${path}`, { ...init, headers, credentials: "omit", cache: "no-store" });
  } catch {
    throw new ApiError(0, "network", "server_unreachable");
  }
  const body = (await res.json().catch(() => null)) as ({ error?: { code: string; message: string } } & T) | null;
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? "http_error", body?.error?.message ?? `HTTP ${res.status}`);
  return body as T;
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Install token, registered once and kept in extension storage (never in page context). */
export async function getToken(server: string, force = false): Promise<string> {
  const key = `token:${server}`;
  if (!force) {
    const stored = (await chrome.storage.local.get(key))[key] as string | undefined;
    if (stored) return stored;
  }
  let installHash = (await chrome.storage.local.get("installHash")).installHash as string | undefined;
  if (!installHash) {
    installHash = randomHex(24);
    await chrome.storage.local.set({ installHash });
  }
  const { installToken } = await call<{ installToken: string }>(server, "/api/v1/extension/register", {
    method: "POST",
    body: JSON.stringify({ installHash, version: chrome.runtime.getManifest().version }),
  });
  await chrome.storage.local.set({ [key]: installToken });
  return installToken;
}

/** Retries once with a fresh token when the stored one was revoked or the DB was reset. */
export async function authed<T>(server: string, path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await call<T>(server, path, { ...init, token: await getToken(server) });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return call<T>(server, path, { ...init, token: await getToken(server, true) });
    throw e;
  }
}

/** ScanPayload → body for POST /api/phishing-intelligence/scan. */
export function toRequest(p: ScanPayload, locale: "sq" | "en") {
  const options = { locale, useVirusTotal: true, aiMode: "hybrid", allowCloudAnalysis: true, threatAttribution: true };
  switch (p.kind) {
    case "email": {
      const e: ExtractedEmail = p.email;
      return {
        channel: "EMAIL",
        source: e.provider,
        email: {
          subject: e.subject?.slice(0, 998),
          sender: e.sender?.slice(0, 320),
          replyTo: e.replyTo?.slice(0, 320),
          body: e.body,
          html: e.html,
          urls: [...new Set(e.links.map((l) => l.href))].filter((u) => u.length <= 2048).slice(0, 200),
          attachments: e.attachments.map((a) => ({ name: a.name.slice(0, 255), mime: a.mime, size: a.size })),
        },
        options,
      };
    }
    case "eml":
      return { channel: "EMAIL", source: "eml", email: { raw: p.raw }, options };
    case "sms":
      return { channel: "SMS", source: "manual_input", message: { text: p.text.slice(0, 5000), ...(p.sender ? { sender: p.sender.slice(0, 64) } : {}) }, options };
    case "selection":
      return p.as === "sms"
        ? { channel: "SMS", source: "manual_input", message: { text: p.text.slice(0, 5000) }, options }
        : { channel: "EMAIL", source: "webmail", email: { body: p.text.slice(0, 90_000) }, options };
  }
}

export interface ScanStatus {
  scanId: string;
  channel: "EMAIL" | "SMS";
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  progress: number;
  stages: Record<string, string>;
  verdict: string;
  riskScore: number | null;
  severity: string | null;
  phishingType: string | null;
  phishingFamily: string | null;
}

export interface Report {
  verdict: string;
  riskScore: number;
  severity: string;
  evidence: {
    engineReasons: { code: string; text_sq: string; text_en: string; weight: number }[];
    findings: { code: string }[];
    email?: {
      subject: string | null;
      from: string | null;
      authentication: { spf: string; dkim: string; dmarc: string; source: string };
      attachments: { name: string; mime: string }[];
      excerpt?: string;
    };
    sms?: { sender: string | null; excerpt: string };
  };
  iocs: { type: string; value: string }[];
  exfil?: { endpoints: { kind: string; value: string; chatId: string | null; otherScans: number }[] };
  reputation: { results: { type: string; value: string; malicious: number; suspicious: number; found: boolean; threatLabel: string | null; categories: string[] }[] };
  classification: { phishingType: { value: string }[]; phishingFamily: { value: string }[] };
  recommendedActions: { sq: string; en: string }[];
}

export interface SubmittedReport {
  reportId: string;
  protocol: string;
  deleteUntil: string;
}

/** POST /api/v1/extension/reports: the signal report lands in the SOC inbox (SPEC 12.3). */
export function submitSignal(server: string, signals: unknown): Promise<SubmittedReport> {
  return authed<SubmittedReport>(server, "/api/v1/extension/reports", { method: "POST", body: JSON.stringify({ signals, consent: true }) });
}

/** DELETE /api/v1/extension/reports/{id}: undo within 10 minutes with the same install token. */
export async function deleteSignal(server: string, reportId: string): Promise<void> {
  await authed<null>(server, `/api/v1/extension/reports/${reportId}`, { method: "DELETE" });
}
