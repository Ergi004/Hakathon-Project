import "server-only";

import { createAdminClient } from "./supabase/admin";

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

const memory = new Map<string, { hits: number; resetAt: number }>();

function memoryLimit(key: string, max: number, windowSec: number): LimitResult {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { hits: 1, resetAt: now + windowSec * 1000 });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return { allowed: true, remaining: max - 1, resetAt: new Date(now + windowSec * 1000) };
  }
  entry.hits += 1;
  return { allowed: entry.hits <= max, remaining: Math.max(0, max - entry.hits), resetAt: new Date(entry.resetAt) };
}

/**
 * limit(key, max, windowSec): in-memory first (cheap, per instance), then the
 * table-backed counter so limits hold across instances (SPEC 12.3, 13.5).
 */
export async function limit(key: string, max: number, windowSec: number): Promise<LimitResult> {
  const local = memoryLimit(key, max, windowSec);
  if (!local.allowed) return local;
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_window_sec: windowSec,
      p_max: max,
    });
    const row = data?.[0];
    if (error || !row) return local;
    return { allowed: row.allowed, remaining: Math.max(0, max - row.current_hits), resetAt: new Date(row.reset_at) };
  } catch {
    return local;
  }
}
