/** Live threat-intelligence contracts. */
export type IntelProviderName = "virustotal" | "urlhaus" | "hybrid_analysis" | "rdap" | "crtsh" | "dns";
export type IntelVerdict = "malicious" | "suspicious" | "clean" | "unknown";
export type IntelStatus = "done" | "error" | "skipped" | "unavailable";

export interface ProviderResult {
  provider: IntelProviderName;
  status: IntelStatus;
  verdict: IntelVerdict;
  maliciousCount?: number;
  totalCount?: number;
  /** Normalised fields only. Never a raw provider payload. Safe to show to anyone. */
  summary: Record<string, unknown>;
  reportUrl?: string;
  error?: string;
}

export interface AdapterContext {
  host: string;
  registrableDomain: string;
  /** Sanitised scheme://host/path, refanged, only for tier B. */
  url?: string;
  signal: AbortSignal;
}

export interface ProviderAdapter {
  name: IntelProviderName;
  tier: "A" | "B";
  run(ctx: AdapterContext): Promise<ProviderResult>;
}

/** Normalised summaries the scorer reads (also what the UI renders). */
export interface RdapSummary { registeredAt?: string; expiresAt?: string; registrar?: string; privacy?: boolean }
export interface VtDomainSummary { malicious: number; suspicious: number; harmless: number; undetected: number; creationDate?: string; registrar?: string; categories: string[] }
export interface CrtSummary { firstCertAt?: string; names: { name: string; firstSeen?: string }[] }
export interface DnsSummary { resolves: boolean; addresses: string[] }
export interface UrlhausSummary { listed: boolean; urlCount: number; threats: string[]; firstSeen?: string; blacklists: Record<string, string> }
export interface HaSummary { verdict?: string; threatScore?: number; state?: string }

export interface SubdomainRow {
  subdomain: string;
  source: "virustotal" | "crtsh";
  resolves?: boolean | null;
  firstCertAt?: string | null;
  verdict: IntelVerdict;
  brandToken: boolean;
}

export const unavailable = (provider: IntelProviderName, error: string): ProviderResult => ({ provider, status: "unavailable", verdict: "unknown", summary: {}, error });
export const skipped = (provider: IntelProviderName, error: string): ProviderResult => ({ provider, status: "skipped", verdict: "unknown", summary: {}, error });
