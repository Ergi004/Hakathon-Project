/**
 * Hot-zone detection for the Geographic Threat Map. Pure functions (no I/O), unit tested.
 *
 * 1. expected_i = national window total × share_i (population share if every region has a
 *    population, otherwise the region's share of the baseline period)
 * 2. z_i = (observed_i − expected_i) / sqrt(expected_i), with expected floored at 0.5
 * 3. smoothed_i = (own + 0.5 × Σ neighbours) / (1 + 0.5 × neighbour count)
 * 4. spike_i = (observed per day in window) / (baseline mean per day), zero baseline guarded
 * 5. severity from thresholds (settings / alert rules, never hard-coded in callers)
 * 6. adjacent elevated/critical regions merge into zones named after the largest municipality
 * 7. fewer than MIN_RANKED reports = "low data": never ranked or highlighted
 */

export const MIN_RANKED = 3;
export const EXPECTED_FLOOR = 0.5;

export type Severity = "watch" | "elevated" | "critical";

export interface Thresholds {
  watch: { minObserved: number; minZ: number };
  elevated: { minObserved: number; minZ: number };
  critical: { minObserved: number; minZ: number; minSpike: number };
  windowDays: number;
  baselineDays: number;
}

export const DEFAULT_GEO_THRESHOLDS: Thresholds = {
  watch: { minObserved: 3, minZ: 1.5 },
  elevated: { minObserved: 5, minZ: 2 },
  critical: { minObserved: 10, minZ: 3, minSpike: 3 },
  windowDays: 7,
  baselineDays: 28,
};

/** Merges settings JSON over the defaults; the minimum ranked count can never drop below 3. */
export function parseThresholds(value: unknown): Thresholds {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Thresholds>;
  const t: Thresholds = {
    watch: { ...DEFAULT_GEO_THRESHOLDS.watch, ...(v.watch ?? {}) },
    elevated: { ...DEFAULT_GEO_THRESHOLDS.elevated, ...(v.elevated ?? {}) },
    critical: { ...DEFAULT_GEO_THRESHOLDS.critical, ...(v.critical ?? {}) },
    windowDays: Number(v.windowDays) > 0 ? Number(v.windowDays) : DEFAULT_GEO_THRESHOLDS.windowDays,
    baselineDays: Number(v.baselineDays) > 0 ? Number(v.baselineDays) : DEFAULT_GEO_THRESHOLDS.baselineDays,
  };
  for (const k of ["watch", "elevated", "critical"] as const) t[k].minObserved = Math.max(MIN_RANKED, Number(t[k].minObserved) || MIN_RANKED);
  return t;
}

export interface RegionInput {
  code: string;
  observed: number;          // reports in the window
  baseline: number;          // reports in the baseline period (before the window)
  population?: number | null;
}

export interface RegionResult {
  code: string;
  observed: number;
  expected: number;
  z: number;
  smoothed: number;
  spike: number | null;      // null = no baseline to compare with
  lowData: boolean;
  severity: Severity | null;
}

export interface Zone {
  code: string;              // anchor municipality (highest count)
  members: string[];
  observed: number;
  expected: number;
  severity: Severity;
}

export function expectedCounts(regions: RegionInput[]): Map<string, number> {
  const total = regions.reduce((s, r) => s + r.observed, 0);
  const usePop = regions.length > 0 && regions.every((r) => (r.population ?? 0) > 0);
  const weights = regions.map((r) => (usePop ? r.population! : r.baseline));
  const wSum = weights.reduce((s, w) => s + w, 0);
  const out = new Map<string, number>();
  regions.forEach((r, i) => {
    // No baseline anywhere: fall back to an even share.
    const share = wSum > 0 ? weights[i] / wSum : 1 / regions.length;
    out.set(r.code, total * share);
  });
  return out;
}

export function zScore(observed: number, expected: number): number {
  const e = Math.max(expected, EXPECTED_FLOOR);
  return (observed - e) / Math.sqrt(e);
}

export function smooth(values: Map<string, number>, neighbors: Map<string, string[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [code, own] of values) {
    const ns = (neighbors.get(code) ?? []).filter((n) => values.has(n));
    const sum = ns.reduce((s, n) => s + (values.get(n) ?? 0), 0);
    out.set(code, (own + 0.5 * sum) / (1 + 0.5 * ns.length));
  }
  return out;
}

export function spikeRatio(observed: number, windowDays: number, baseline: number, baselineDays: number): number | null {
  if (windowDays <= 0 || baselineDays <= 0) return null;
  const perDay = observed / windowDays;
  const basePerDay = baseline / baselineDays;
  if (basePerDay === 0) return observed > 0 ? Infinity : null;
  return perDay / basePerDay;
}

export function severityOf(r: { observed: number; z: number; spike: number | null }, t: Thresholds): Severity | null {
  if (r.observed < MIN_RANKED) return null;
  const spike = r.spike ?? 0;
  if (r.observed >= t.critical.minObserved && r.z >= t.critical.minZ && spike >= t.critical.minSpike) return "critical";
  if (r.observed >= t.elevated.minObserved && r.z >= t.elevated.minZ) return "elevated";
  if (r.observed >= t.watch.minObserved && r.z >= t.watch.minZ) return "watch";
  return null;
}

export function analyzeRegions(regions: RegionInput[], neighbors: Map<string, string[]>, t: Thresholds): RegionResult[] {
  const expected = expectedCounts(regions);
  const smoothed = smooth(new Map(regions.map((r) => [r.code, r.observed])), neighbors);
  return regions.map((r) => {
    const e = expected.get(r.code) ?? 0;
    const z = zScore(r.observed, e);
    const spike = spikeRatio(r.observed, t.windowDays, r.baseline, t.baselineDays);
    const lowData = r.observed < MIN_RANKED;
    return { code: r.code, observed: r.observed, expected: e, z, smoothed: smoothed.get(r.code) ?? 0, spike, lowData, severity: lowData ? null : severityOf({ observed: r.observed, z, spike }, t) };
  });
}

const RANK: Record<Severity, number> = { watch: 1, elevated: 2, critical: 3 };

/** Connected components of adjacent elevated/critical regions. */
export function mergeZones(results: RegionResult[], neighbors: Map<string, string[]>): Zone[] {
  const hot = new Map(results.filter((r) => r.severity === "elevated" || r.severity === "critical").map((r) => [r.code, r]));
  const seen = new Set<string>();
  const zones: Zone[] = [];
  for (const code of hot.keys()) {
    if (seen.has(code)) continue;
    const stack = [code];
    const members: RegionResult[] = [];
    seen.add(code);
    while (stack.length) {
      const c = stack.pop()!;
      members.push(hot.get(c)!);
      for (const n of neighbors.get(c) ?? []) if (hot.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
    members.sort((a, b) => b.observed - a.observed || a.code.localeCompare(b.code));
    zones.push({
      code: members[0].code,
      members: members.map((m) => m.code),
      observed: members.reduce((s, m) => s + m.observed, 0),
      expected: members.reduce((s, m) => s + m.expected, 0),
      severity: members.reduce<Severity>((s, m) => (RANK[m.severity!] > RANK[s] ? m.severity! : s), "elevated"),
    });
  }
  return zones.sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.observed - a.observed);
}

/** Ranked list: low-data regions are never ranked. */
export function rankHotspots(results: RegionResult[]): RegionResult[] {
  return results
    .filter((r) => !r.lowData && r.severity)
    .sort((a, b) => RANK[b.severity!] - RANK[a.severity!] || b.z - a.z || b.observed - a.observed);
}

export interface AlertRule { minReports: number; minZ: number; minSpike: number; institutionId?: string | null; regionCode?: string | null }

/** Whether a hot region should notify staff under a rule (rules never go below the low-data floor). */
export function ruleMatches(rule: AlertRule, r: RegionResult, topInstitutionId: string | null): boolean {
  if (r.lowData || (r.severity !== "elevated" && r.severity !== "critical")) return false;
  if (rule.regionCode && rule.regionCode !== r.code) return false;
  if (rule.institutionId && rule.institutionId !== topInstitutionId) return false;
  return r.observed >= Math.max(MIN_RANKED, rule.minReports) && r.z >= rule.minZ && (r.spike ?? 0) >= rule.minSpike;
}
