import "server-only";

import { tryAdmin } from "@/server/db";
import { sha256 } from "@/server/hash";
import type { IntelProviderName } from "./types";

/** provider:sha256(host) → normalised payload. 24 h, URLhaus 1 h. */
export function cacheKey(provider: IntelProviderName, subject: string, variant = ""): string {
  return `${provider}:${variant ? `${variant}:` : ""}${sha256(subject.toLowerCase())}`;
}

export const TTL_MS: Partial<Record<IntelProviderName, number>> = { urlhaus: 3_600_000 };

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = tryAdmin();
  if (!db) return null;
  const { data } = await db.from("intel_cache").select("payload, expires_at").eq("key", key).maybeSingle();
  if (!data || Date.parse(data.expires_at) < Date.now()) return null;
  return data.payload as T;
}

export async function cacheSet(key: string, provider: IntelProviderName, payload: unknown) {
  const db = tryAdmin();
  if (!db) return;
  const ttl = TTL_MS[provider] ?? 24 * 3_600_000;
  await db.from("intel_cache").upsert({ key, provider, payload: payload as never, expires_at: new Date(Date.now() + ttl).toISOString() });
}
