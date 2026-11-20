import type { IntelProviderName } from "./types";

/**
 * Per-provider token buckets sized under the free quotas, plus a circuit breaker.
 * In-memory per server instance; when a bucket is empty the caller returns
 * "unavailable" instead of waiting.
 * - VirusTotal public API: 4 requests/minute, 500/day (docs: public-vs-premium-api).
 * - rdap.org: 10 requests per 10 seconds (about.rdap.org).
 * - URLhaus, crt.sh, Hybrid Analysis: no numeric limit published; conservative values.
 */
const BUCKETS: Record<IntelProviderName, { capacity: number; refillPerSec: number }> = {
  virustotal: { capacity: 4, refillPerSec: 4 / 60 },
  urlhaus: { capacity: 30, refillPerSec: 0.5 },
  hybrid_analysis: { capacity: 5, refillPerSec: 5 / 60 },
  rdap: { capacity: 10, refillPerSec: 1 },
  crtsh: { capacity: 5, refillPerSec: 5 / 60 },
  dns: { capacity: 100, refillPerSec: 50 },
};

const state = new Map<IntelProviderName, { tokens: number; at: number }>();
const breaker = new Map<IntelProviderName, { failures: number; openUntil: number }>();

export function takeToken(p: IntelProviderName, now = Date.now()): boolean {
  const cfg = BUCKETS[p];
  const s = state.get(p) ?? { tokens: cfg.capacity, at: now };
  const tokens = Math.min(cfg.capacity, s.tokens + ((now - s.at) / 1000) * cfg.refillPerSec);
  if (tokens < 1) {
    state.set(p, { tokens, at: now });
    return false;
  }
  state.set(p, { tokens: tokens - 1, at: now });
  return true;
}

export function circuitOpen(p: IntelProviderName, now = Date.now()): boolean {
  const b = breaker.get(p);
  return !!b && b.openUntil > now;
}

/** After 3 consecutive failures skip the provider for 5 minutes. */
export function recordOutcome(p: IntelProviderName, ok: boolean, now = Date.now()) {
  if (ok) return breaker.delete(p);
  const b = breaker.get(p) ?? { failures: 0, openUntil: 0 };
  b.failures += 1;
  if (b.failures >= 3) {
    b.openUntil = now + 5 * 60_000;
    b.failures = 0;
  }
  breaker.set(p, b);
}

export function resetLimits() {
  state.clear();
  breaker.clear();
}
