import { z } from "zod";

/** /soc/geo filters, all in URL search params so every view is shareable. */
export const FLAGS_ORDER = ["green", "yellow", "orange", "red", "darkred"] as const;
export const SOURCE_GROUPS = { citizen: ["citizen_report", "citizen_check"], extension: ["extension"], business: ["business"] } as const;
export const LAYERS = ["municipalities", "hex", "counties", "zones", "bubbles"] as const;
export const METRICS = ["count", "rate", "change", "z"] as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const csv = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number][]) =>
  z.string().optional().transform((v) => {
    const out = (v ?? "").split(",").filter((x): x is T[number] => (values as readonly string[]).includes(x));
    return out.length ? out : fallback;
  });

export const geoFilterSchema = z.object({
  range: z.enum(["24h", "7d", "30d", "custom"]).catch("7d"),
  from: day.optional().catch(undefined),
  to: day.optional().catch(undefined),
  mode: z.enum(["victim", "imitated"]).catch("victim"),
  institution: z.uuid().optional().catch(undefined),
  tactic: z.string().max(64).regex(/^[a-z0-9_]+$/).optional().catch(undefined),
  campaign: z.string().max(32).regex(/^[A-Za-z0-9-]+$/).optional().catch(undefined),
  channel: z.enum(["sms", "email", "social", "web", "qr", "call", "other"]).optional().catch(undefined),
  minFlag: z.enum(FLAGS_ORDER).optional().catch(undefined),
  source: z.enum(["citizen", "extension", "business"]).optional().catch(undefined),
  confirmed: z.enum(["1", "0"]).optional().catch(undefined).transform((v) => v === "1"),
  compare: z.enum(["1", "0"]).optional().catch(undefined).transform((v) => v === "1"),
  layers: csv(LAYERS, ["municipalities", "counties", "zones"]),
  metric: z.enum(METRICS).catch("count"),
  view: z.enum(["map", "table"]).catch("map"),
});
export type GeoFilters = z.infer<typeof geoFilterSchema>;

export function parseGeoFilters(sp: Record<string, string | string[] | undefined>): GeoFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return geoFilterSchema.parse(flat);
}

/** True when only range/mode/display options are set (precomputed hot spots apply). */
export function isUnfiltered(f: GeoFilters): boolean {
  return !f.institution && !f.tactic && !f.campaign && !f.channel && !f.minFlag && !f.source && !f.confirmed;
}

const DAY_MS = 86_400_000;
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (dayStr: string, n: number) => isoDay(new Date(Date.parse(`${dayStr}T00:00:00Z`) + n * DAY_MS));

/** Today in Albania (Europe/Tirane), as YYYY-MM-DD. */
export function tiranaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export interface GeoWindow { from: string; to: string; days: string[]; prevFrom: string; prevTo: string; baselineFrom: string; baselineDays: number }

/** Window of whole days (Tirana time). "24h" is today's calendar day; custom is capped at 90 days. */
export function resolveWindow(f: Pick<GeoFilters, "range" | "from" | "to">, today = tiranaToday(), baselineDays = 28): GeoWindow {
  let to = today, n = 7;
  if (f.range === "24h") n = 1;
  else if (f.range === "30d") n = 30;
  else if (f.range === "custom" && f.from && f.to && f.from <= f.to) {
    to = f.to > today ? today : f.to;
    n = Math.min(90, Math.round((Date.parse(to) - Date.parse(f.from)) / DAY_MS) + 1);
  }
  const from = addDays(to, -(n - 1));
  const days = Array.from({ length: n }, (_, i) => addDays(from, i));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(n - 1));
  const span = Math.max(baselineDays, n);
  return { from, to, days, prevFrom, prevTo, baselineFrom: addDays(from, -span), baselineDays: span };
}

/** Minimal query-builder surface we use, so the filter → SQL mapping is unit-testable. */
export interface FilterableQuery<Q> {
  eq(column: string, value: unknown): Q;
  in(column: string, values: readonly unknown[]): Q;
  gte(column: string, value: unknown): Q;
  lte(column: string, value: unknown): Q;
}

/** Applies the filters to a region_daily_stats query (campaign is resolved to its id first). */
export function applyStatsFilters<Q extends FilterableQuery<Q>>(q: Q, f: GeoFilters, opts: { from: string; to: string; campaignId?: string | null }): Q {
  let out = q.eq("mode", f.mode).gte("day", opts.from).lte("day", opts.to);
  if (f.institution) out = out.eq("institution_id", f.institution);
  if (f.tactic) out = out.eq("tactic", f.tactic);
  if (f.campaign) out = out.eq("campaign_id", opts.campaignId ?? "00000000-0000-0000-0000-000000000000");
  if (f.channel) out = out.eq("channel", f.channel);
  if (f.minFlag) out = out.in("flag", FLAGS_ORDER.slice(FLAGS_ORDER.indexOf(f.minFlag)));
  if (f.source) out = out.in("source", SOURCE_GROUPS[f.source]);
  if (f.confirmed) out = out.eq("confirmed", true);
  return out;
}

/** Serialises filters back to a query string (defaults omitted). */
export function filtersToQuery(f: Partial<GeoFilters>): string {
  const sp = new URLSearchParams();
  const set = (k: string, v: unknown, def?: unknown) => { if (v !== undefined && v !== null && v !== "" && v !== false && v !== def) sp.set(k, String(v)); };
  set("range", f.range, "7d");
  if (f.range === "custom") { set("from", f.from); set("to", f.to); }
  set("mode", f.mode, "victim");
  set("institution", f.institution); set("tactic", f.tactic); set("campaign", f.campaign); set("channel", f.channel);
  set("minFlag", f.minFlag); set("source", f.source);
  if (f.confirmed) sp.set("confirmed", "1");
  if (f.compare) sp.set("compare", "1");
  if (f.layers && f.layers.join(",") !== "municipalities,counties,zones") sp.set("layers", f.layers.join(","));
  set("metric", f.metric, "count"); set("view", f.view, "map");
  return sp.toString();
}
