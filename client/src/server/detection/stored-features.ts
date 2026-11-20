/**
 * Read classification features back from checks.features.
 * The JSON may carry extra keys (claimed place, overlap). It never contains the message.
 */
import type { GroupCandidate, MatchedSignal, ScamFeatures } from "./pattern";
import { classifyScam } from "./pattern";

export function readScamFeatures(value: unknown): ScamFeatures | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<ScamFeatures>;
  if (!row.domain || typeof row.domain !== "object") return null;
  if (!row.content || typeof row.content !== "object") return null;
  if (!row.infrastructure || typeof row.infrastructure !== "object") return null;
  if (!Array.isArray(row.exfil) || !Array.isArray(row.brands) || !Array.isArray(row.themes)) return null;
  return row as ScamFeatures;
}

export function readHostingCountry(value: unknown): string | null {
  const country = readScamFeatures(value)?.infrastructure.hostingCountry;
  return typeof country === "string" && country.trim() ? country.trim() : null;
}

export function readClaimedPlace(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const place = (value as { claimedPlace?: unknown }).claimedPlace;
  return typeof place === "string" && place.trim() ? place.trim().slice(0, 120) : null;
}

export function readMatchedSignals(value: unknown): MatchedSignal[] {
  const features = readScamFeatures(value);
  if (!features) return [];
  return classifyScam(features).matchedSignals;
}

/** Grouping keys already stored on features. Text is not reconstructed. */
export function candidateFromStored(value: unknown): GroupCandidate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as { domain?: { host?: unknown }; exfil?: unknown };
  const host = typeof row.domain?.host === "string" && row.domain.host ? row.domain.host : null;
  const urls: string[] = [];
  const exfilEndpoints: string[] = [];
  if (Array.isArray(row.exfil)) {
    for (const item of row.exfil) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { url?: unknown; endpoint?: unknown };
      if (typeof entry.url === "string" && entry.url) urls.push(entry.url);
      if (typeof entry.endpoint === "string" && entry.endpoint) exfilEndpoints.push(entry.endpoint);
    }
  }
  if (!host && urls.length === 0 && exfilEndpoints.length === 0) return null;
  return { hosts: host ? [host] : [], urls, exfilEndpoints };
}
