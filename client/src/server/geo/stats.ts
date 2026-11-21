import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyStatsFilters, isUnfiltered, resolveWindow, type GeoFilters, type GeoWindow } from "@/lib/geo/filters";
import { HAS_POPULATION, MUNICIPALITIES, NEIGHBORS, REGION_BY_CODE, regionName } from "@/lib/geo/regions";
import type { Database } from "@/types/database";
import { analyzeRegions, mergeZones, parseThresholds, rankHotspots, type RegionResult, type Severity, type Thresholds } from "./hotspots";
import { regionIdMaps } from "./regions";

type Db = SupabaseClient<Database>;
interface StatRow { region_id: string | null; day: string; institution_id: string | null; campaign_id: string | null; tactic: string | null; channel: string | null; report_count: number }

export interface RegionMetric {
  code: string;
  name: string;
  county: string;
  observed: number;
  prev: number;
  daily: number[];
  rate: number | null;
  change: number | null;
  z: number;
  expected: number;
  spike: number | null;
  severity: Severity | null;
  lowData: boolean;
  topInstitution: string | null;
}

export interface HotItem {
  code: string;               // anchor municipality
  name: string;
  members: string[];
  severity: Severity;
  observed: number;
  expected: number;
  spike: number | null;
  topCampaign: { id: string; code: string } | null;
  topInstitution: { id: string; name: string } | null;
}

export interface GeoData {
  ready: boolean;
  window: GeoWindow;
  metrics: RegionMetric[];
  unknown: { count: number; share: number; prev: number };
  total: number;
  prevTotal: number;
  dailyTotals: number[];
  hot: HotItem[];
  hotSource: "precomputed" | "live";
  computedAt: string | null;
  demo: boolean;
  hasPopulation: boolean;
  thresholds: Thresholds;
  options: { institutions: { id: string; name: string }[]; campaigns: { code: string; label: string }[]; tactics: string[] };
}

/** PostgREST returns at most 1000 rows per request: page through. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error("geo stats query failed");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadThresholds(db: Db): Promise<Thresholds> {
  const { data } = await db.from("settings").select("value").eq("key", "geo_thresholds").maybeSingle();
  return parseThresholds(data?.value);
}

async function campaignIdFor(db: Db, code?: string): Promise<string | null> {
  if (!code) return null;
  const { data } = await db.from("campaigns").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

export async function fetchStats(db: Db, f: GeoFilters, from: string, to: string): Promise<StatRow[]> {
  const campaignId = await campaignIdFor(db, f.campaign);
  return fetchAll<StatRow>((a, b) =>
    applyStatsFilters(db.from("region_daily_stats").select("region_id, day, institution_id, campaign_id, tactic, channel, report_count"), f, { from, to, campaignId }).order("id").range(a, b),
  );
}

interface Agg { observed: number; prev: number; baseline: number; daily: number[]; inst: Map<string, number>; camp: Map<string, number> }

/** Aggregates stat rows into per-municipality window / previous / baseline counts. */
export function aggregate(rows: StatRow[], w: GeoWindow, codeById: Map<string, string>) {
  const dayIndex = new Map(w.days.map((d, i) => [d, i]));
  const per = new Map<string, Agg>(MUNICIPALITIES.map((m) => [m.code, { observed: 0, prev: 0, baseline: 0, daily: w.days.map(() => 0), inst: new Map(), camp: new Map() }]));
  const unknown = { count: 0, prev: 0 };
  const dailyTotals = w.days.map(() => 0);
  for (const r of rows) {
    const n = r.report_count;
    const inWindow = r.day >= w.from && r.day <= w.to;
    const inPrev = r.day >= w.prevFrom && r.day <= w.prevTo;
    const inBaseline = r.day >= w.baselineFrom && r.day < w.from;
    if (inWindow) dailyTotals[dayIndex.get(r.day)!] += n;
    const code = r.region_id ? codeById.get(r.region_id) : undefined;
    if (!code) {
      if (inWindow) unknown.count += n;
      if (inPrev) unknown.prev += n;
      continue;
    }
    const a = per.get(code);
    if (!a) continue;
    if (inWindow) {
      a.observed += n;
      a.daily[dayIndex.get(r.day)!] += n;
      if (r.institution_id) a.inst.set(r.institution_id, (a.inst.get(r.institution_id) ?? 0) + n);
      if (r.campaign_id) a.camp.set(r.campaign_id, (a.camp.get(r.campaign_id) ?? 0) + n);
    }
    if (inPrev) a.prev += n;
    if (inBaseline) a.baseline += n;
  }
  return { per, unknown, dailyTotals };
}

const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

export function analyze(per: Map<string, Agg>, t: Thresholds, w: GeoWindow): RegionResult[] {
  return analyzeRegions(
    MUNICIPALITIES.map((m) => ({ code: m.code, observed: per.get(m.code)!.observed, baseline: per.get(m.code)!.baseline, population: m.population })),
    NEIGHBORS,
    { ...t, windowDays: w.days.length, baselineDays: w.baselineDays },
  );
}

export async function getGeoData(db: Db, f: GeoFilters, locale: string): Promise<GeoData> {
  const thresholds = await loadThresholds(db);
  const w = resolveWindow(f, undefined, thresholds.baselineDays);
  const [{ codeById, idByCode }, insts, camps] = await Promise.all([
    regionIdMaps(db),
    db.from("institutions").select("id, name").order("name"),
    db.from("campaigns").select("id, code, imitated_name, tactic").order("code").limit(500),
  ]);
  const instName = new Map((insts.data ?? []).map((i) => [i.id, i.name]));
  const campCode = new Map((camps.data ?? []).map((c) => [c.id, c.code]));
  const options = {
    institutions: (insts.data ?? []).map((i) => ({ id: i.id, name: i.name })),
    campaigns: (camps.data ?? []).map((c) => ({ code: c.code, label: `${c.code}${c.imitated_name ? ` · ${c.imitated_name}` : ""}` })),
    tactics: [...new Set((camps.data ?? []).map((c) => c.tactic).filter(Boolean))].sort(),
  };
  const empty: GeoData = { ready: idByCode.size > 0, window: w, metrics: [], unknown: { count: 0, share: 0, prev: 0 }, total: 0, prevTotal: 0, dailyTotals: w.days.map(() => 0), hot: [], hotSource: "live", computedAt: null, demo: false, hasPopulation: HAS_POPULATION, thresholds, options };
  if (!idByCode.size) return empty;

  const rows = await fetchStats(db, f, w.baselineFrom, w.to);
  const { per, unknown, dailyTotals } = aggregate(rows, w, codeById);
  const results = analyze(per, thresholds, w);
  const byCode = new Map(results.map((r) => [r.code, r]));

  const metrics: RegionMetric[] = MUNICIPALITIES.map((m) => {
    const a = per.get(m.code)!;
    const r = byCode.get(m.code)!;
    const ti = top(a.inst);
    return {
      code: m.code,
      name: regionName(m.code, locale),
      county: regionName(m.parent_code, locale),
      observed: a.observed,
      prev: a.prev,
      daily: a.daily,
      rate: m.population ? (a.observed / m.population) * 10_000 : null,
      change: a.prev > 0 ? (a.observed - a.prev) / a.prev : null,
      z: r.z,
      expected: r.expected,
      spike: r.spike === Infinity ? null : r.spike,
      severity: r.severity,
      lowData: r.lowData,
      topInstitution: ti ? instName.get(ti) ?? null : null,
    };
  });
  const total = metrics.reduce((s, m) => s + m.observed, 0) + unknown.count;
  const prevTotal = metrics.reduce((s, m) => s + m.prev, 0) + unknown.prev;

  // Hot zones: precomputed by the cron job for the default view, live for filtered views.
  let hot: HotItem[] = [];
  let hotSource: GeoData["hotSource"] = "live";
  let computedAt: string | null = null;
  const toItem = (code: string, members: string[], severity: Severity, observed: number, expected: number, spike: number | null): HotItem => {
    const camp = new Map<string, number>(), inst = new Map<string, number>();
    for (const c of members) {
      for (const [k, v] of per.get(c)?.camp ?? []) camp.set(k, (camp.get(k) ?? 0) + v);
      for (const [k, v] of per.get(c)?.inst ?? []) inst.set(k, (inst.get(k) ?? 0) + v);
    }
    const tc = top(camp), tinst = top(inst);
    return { code, name: regionName(code, locale), members, severity, observed, expected, spike: spike === Infinity ? null : spike, topCampaign: tc ? { id: tc, code: campCode.get(tc) ?? "" } : null, topInstitution: tinst ? { id: tinst, name: instName.get(tinst) ?? "" } : null };
  };

  if (isUnfiltered(f) && f.range === "7d") {
    const { data: latest } = await db.from("geo_hotspots").select("computed_at").eq("mode", f.mode).order("computed_at", { ascending: false }).limit(1).maybeSingle();
    if (latest) {
      const { data: rowsHs } = await db.from("geo_hotspots").select("region_id, observed, expected, spike_ratio, severity, zone_code").eq("mode", f.mode).eq("computed_at", latest.computed_at);
      const RANK = { watch: 1, elevated: 2, critical: 3 } as const;
      const groups = new Map<string, NonNullable<typeof rowsHs>>();
      for (const h of rowsHs ?? []) {
        const code = codeById.get(h.region_id);
        if (!code || h.observed < 3) continue;
        const key = h.zone_code ?? code;
        groups.set(key, [...(groups.get(key) ?? []), h]);
      }
      hot = [...groups.entries()].map(([key, hs]) => {
        const sev = hs.reduce<Severity>((s, h) => (RANK[h.severity as Severity] > RANK[s] ? (h.severity as Severity) : s), "watch");
        const anchor = hs.find((h) => codeById.get(h.region_id) === key) ?? hs[0];
        return toItem(key, hs.map((h) => codeById.get(h.region_id)!), sev, hs.reduce((s, h) => s + h.observed, 0), hs.reduce((s, h) => s + Number(h.expected), 0), anchor.spike_ratio === null ? null : Number(anchor.spike_ratio));
      }).sort((a, b) => RANK[b.severity] - RANK[a.severity] || b.observed - a.observed);
      hotSource = "precomputed";
      computedAt = latest.computed_at;
    }
  }
  if (hotSource === "live") {
    const zones = mergeZones(results, NEIGHBORS);
    const inZone = new Set(zones.flatMap((z) => z.members));
    hot = [
      ...zones.map((z) => toItem(z.code, z.members, z.severity, z.observed, z.expected, byCode.get(z.code)?.spike ?? null)),
      ...rankHotspots(results).filter((r) => !inZone.has(r.code)).map((r) => toItem(r.code, [r.code], r.severity!, r.observed, r.expected, r.spike)),
    ];
  }

  // "Demo data" badge: most reports in the window are synthetic seed reports.
  const [{ count: demoCount }, { count: allCount }] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).like("protocol", "DEMO-%").gte("created_at", `${w.from}T00:00:00Z`),
    db.from("reports").select("id", { count: "exact", head: true }).gte("created_at", `${w.from}T00:00:00Z`),
  ]);

  return {
    ...empty,
    metrics,
    unknown: { ...unknown, share: total ? unknown.count / total : 0 },
    total,
    prevTotal,
    dailyTotals,
    hot,
    hotSource,
    computedAt,
    demo: (allCount ?? 0) > 0 && (demoCount ?? 0) / (allCount ?? 1) > 0.5,
  };
}

export const roundToHour = (iso: string) => { const d = new Date(iso); d.setUTCMinutes(0, 0, 0); return d.toISOString(); };

export interface RegionDetail {
  code: string;
  name: string;
  county: string;
  population: number | null;
  populationYear: number | null;
  counts: { h24: number; d7: number; d30: number };
  rate30: number | null;
  trend: { day: string; count: number }[];
  institutions: { name: string; count: number }[];
  tactics: { name: string; count: number }[];
  channels: { name: string; count: number }[];
  campaigns: { id: string; code: string; label: string; count: number }[];
  reports: { id: string; protocol: string; flag: string | null; channel: string | null; hour: string }[];
  notes: { id: string; body: string; author: string; at: string }[];
  hotspot: { severity: Severity; computedAt: string } | null;
}

/** Drawer and /soc/geo/[code]: aggregates and masked rows only (no text, contacts or tokens). */
export async function getRegionDetail(db: Db, code: string, f: GeoFilters, locale: string): Promise<RegionDetail | null> {
  const info = REGION_BY_CODE.get(code);
  if (!info || info.level !== "municipality") return null;
  const { data: region } = await db.from("regions").select("id").eq("code", code).maybeSingle();
  if (!region) return null;
  const thresholds = await loadThresholds(db);
  const w30 = resolveWindow({ range: "30d" }, undefined, thresholds.baselineDays);
  const campaignId = await campaignIdFor(db, f.campaign);
  const rows = await fetchAll<StatRow>((a, b) =>
    applyStatsFilters(db.from("region_daily_stats").select("region_id, day, institution_id, campaign_id, tactic, channel, report_count").eq("region_id", region.id), f, { from: w30.from, to: w30.to, campaignId }).order("id").range(a, b),
  );
  const today = w30.to;
  const d7 = w30.days[w30.days.length - 7];
  const sum = (pred: (r: StatRow) => boolean) => rows.filter(pred).reduce((s, r) => s + r.report_count, 0);
  const tally = (key: (r: StatRow) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + r.report_count); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const [insts, camps, latestHs, notes] = await Promise.all([
    db.from("institutions").select("id, name"),
    db.from("campaigns").select("id, code, imitated_name"),
    db.from("geo_hotspots").select("severity, computed_at").eq("region_id", region.id).eq("mode", f.mode).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("region_notes").select("id, body, created_at, author_id").eq("region_id", region.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const authorIds = [...new Set((notes.data ?? []).map((n) => n.author_id))];
  const { data: authors } = authorIds.length ? await db.from("profiles").select("id, full_name").in("id", authorIds) : { data: [] };
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.full_name ?? "—"]));
  const instName = new Map((insts.data ?? []).map((i) => [i.id, i.name]));
  const campInfo = new Map((camps.data ?? []).map((c) => [c.id, c]));

  // Latest reports: victim mode = reported from here; imitated mode = campaigns targeting this area.
  let rq = db.from("reports").select("id, protocol, flag, channel, created_at").order("created_at", { ascending: false }).limit(10);
  if (f.mode === "victim") rq = rq.eq("region_id", region.id);
  else {
    const { data: targeting } = await db.from("campaigns").select("id").eq("target_region_id", region.id);
    rq = rq.in("campaign_id", (targeting ?? []).map((c) => c.id).concat("00000000-0000-0000-0000-000000000000"));
  }
  if (campaignId) rq = rq.eq("campaign_id", campaignId);
  const { data: latest } = await rq;

  return {
    code,
    name: regionName(code, locale),
    county: regionName(info.parent_code, locale),
    population: info.population,
    populationYear: info.population_year,
    counts: { h24: sum((r) => r.day === today), d7: sum((r) => r.day >= d7), d30: sum(() => true) },
    rate30: info.population ? (sum(() => true) / info.population) * 10_000 : null,
    trend: w30.days.map((d) => ({ day: d, count: sum((r) => r.day === d) })),
    institutions: tally((r) => r.institution_id).slice(0, 5).map(([id, count]) => ({ name: instName.get(id) ?? "—", count })),
    tactics: tally((r) => r.tactic).slice(0, 5).map(([name, count]) => ({ name, count })),
    channels: tally((r) => r.channel).map(([name, count]) => ({ name, count })),
    campaigns: tally((r) => r.campaign_id).slice(0, 8).map(([id, count]) => ({ id, code: campInfo.get(id)?.code ?? "", label: campInfo.get(id)?.imitated_name ?? "", count })),
    reports: (latest ?? []).map((r) => ({ id: r.id, protocol: r.protocol, flag: r.flag, channel: r.channel, hour: roundToHour(r.created_at) })),
    notes: (notes.data ?? []).map((n) => ({ id: n.id, body: n.body, author: authorName.get(n.author_id) ?? "—", at: n.created_at })),
    hotspot: latestHs.data ? { severity: latestHs.data.severity as Severity, computedAt: latestHs.data.computed_at } : null,
  };
}

/** Campaign workspace "Geography" tab: where its reports come from + the imitated authority's area. */
export async function getCampaignGeography(db: Db, campaign: { id: string; code: string; target_region_id?: string | null; institution_id?: string | null }) {
  const { codeById } = await regionIdMaps(db);
  if (!codeById.size) return null;
  const thresholds = await loadThresholds(db);
  const w = resolveWindow({ range: "30d" }, undefined, thresholds.baselineDays);
  const rows = await fetchAll<StatRow>((a, b) =>
    db.from("region_daily_stats").select("region_id, day, institution_id, campaign_id, tactic, channel, report_count").eq("mode", "victim").eq("campaign_id", campaign.id).gte("day", w.from).lte("day", w.to).order("id").range(a, b),
  );
  const counts: Record<string, number> = {};
  let unknown = 0;
  for (const r of rows) {
    const code = r.region_id ? codeById.get(r.region_id) : undefined;
    if (code) counts[code] = (counts[code] ?? 0) + r.report_count;
    else unknown += r.report_count;
  }
  let target = campaign.target_region_id ?? null;
  if (!target && campaign.institution_id) target = (await db.from("institutions").select("region_id").eq("id", campaign.institution_id).maybeSingle()).data?.region_id ?? null;
  return { counts, unknown, total: unknown + Object.values(counts).reduce((s, n) => s + n, 0), imitatedCode: target ? codeById.get(target) ?? null : null, from: w.from, to: w.to };
}

/** Command centre tile: latest top hot zones (victim mode). */
export async function getTopHotZones(db: Db, locale: string, limit = 3) {
  const { codeById } = await regionIdMaps(db);
  const { data: latest } = await db.from("geo_hotspots").select("computed_at").eq("mode", "victim").order("computed_at", { ascending: false }).limit(1).maybeSingle();
  if (!latest) return { zones: [], computedAt: null, ready: codeById.size > 0 };
  const { data } = await db.from("geo_hotspots").select("region_id, observed, expected, severity, zone_code, spike_ratio").eq("mode", "victim").eq("computed_at", latest.computed_at).in("severity", ["elevated", "critical"]);
  const groups = new Map<string, { code: string; observed: number; expected: number; severity: Severity; members: string[] }>();
  for (const h of data ?? []) {
    const code = codeById.get(h.region_id);
    if (!code || h.observed < 3) continue;
    const key = h.zone_code ?? code;
    const g = groups.get(key) ?? { code: key, observed: 0, expected: 0, severity: "elevated" as Severity, members: [] };
    g.observed += h.observed;
    g.expected += Number(h.expected);
    g.members.push(code);
    if (h.severity === "critical") g.severity = "critical";
    groups.set(key, g);
  }
  const zones = [...groups.values()].sort((a, b) => (a.severity === b.severity ? b.observed - a.observed : a.severity === "critical" ? -1 : 1)).slice(0, limit).map((z) => ({ ...z, name: regionName(z.code, locale) }));
  return { zones, computedAt: latest.computed_at, ready: true };
}
