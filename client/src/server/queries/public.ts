import "server-only";

import { cache } from "react";
import type { CampaignCardData } from "@/components/shared/campaign-card";
import { pageCount, pageRange } from "@/lib/pagination";
import { tryAdmin } from "@/server/db";
import type { Enums } from "@/types/database";

/** A region is omitted until this many checks share it. */
export const MIN_REGION_CHECKS = 3;

/** Recent checks included in public pattern aggregates. */
const AGGREGATE_CHECK_LIMIT = 5000;

export type RegionKind = "hosting_country" | "claimed_place";

export interface PatternAggregates {
  byScamType: { scamType: string; count: number }[];
  byBrand: { brand: string; count: number }[];
  byWeek: { week: string; count: number }[];
  regions: { kind: RegionKind; name: string; count: number }[];
}

export interface PublicStats extends PatternAggregates {
  reportsToday: number;
  activeCampaigns: number;
  domainsBlocked: number;
  checksTotal: number;
}

export const EMPTY_PATTERN_AGGREGATES: PatternAggregates = {
  byScamType: [],
  byBrand: [],
  byWeek: [],
  regions: [],
};

function weekStart(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function bump(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function ranked(map: Map<string, number>, min = 1): { name: string; count: number }[] {
  return [...map.entries()]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

/** Trimmed non-empty string (the JSON path reads come back untyped). */
function str(value: unknown, max = 120): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function summarizeChecks(
  rows: { scam_type: string | null; impersonated_brand: string | null; hosting: unknown; place: unknown; created_at: string }[],
): PatternAggregates {
  const scamTypes = new Map<string, number>();
  const brands = new Map<string, number>();
  const weeks = new Map<string, number>();
  const hosting = new Map<string, number>();
  const places = new Map<string, number>();
  for (const row of rows) {
    bump(scamTypes, row.scam_type);
    bump(brands, row.impersonated_brand);
    bump(weeks, weekStart(row.created_at));
    bump(hosting, str(row.hosting));
    bump(places, str(row.place));
  }
  return {
    byScamType: ranked(scamTypes).map(({ name, count }) => ({ scamType: name, count })),
    byBrand: ranked(brands).map(({ name, count }) => ({ brand: name, count })),
    byWeek: [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, count]) => ({ week, count })),
    regions: [
      ...ranked(hosting, MIN_REGION_CHECKS).map(({ name, count }) => ({ kind: "hosting_country" as const, name, count })),
      ...ranked(places, MIN_REGION_CHECKS).map(({ name, count }) => ({ kind: "claimed_place" as const, name, count })),
    ],
  };
}

/**
 * Homepage counters (SPEC 7). Deduplicated per request; the HTTP API adds s-maxage=60.
 * The aggregate reads only the two JSON fields it needs, not the whole `features` document.
 */
export const getPublicStats = cache(async (): Promise<PublicStats> => {
  const db = tryAdmin();
  if (!db) return { reportsToday: 0, activeCampaigns: 0, domainsBlocked: 0, checksTotal: 0, ...EMPTY_PATTERN_AGGREGATES };
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const [r, c, d, k, pattern] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()),
    db.from("campaigns").select("id", { count: "exact", head: true }).in("status", ["monitoring", "confirmed", "takedown_in_progress"]),
    db.from("domains").select("id", { count: "exact", head: true }).in("status", ["threat", "taken_down"]),
    db.from("checks").select("id", { count: "exact", head: true }),
    db.from("checks").select("scam_type, impersonated_brand, created_at, hosting:features->infrastructure->>hostingCountry, place:features->>claimedPlace").order("created_at", { ascending: false }).limit(AGGREGATE_CHECK_LIMIT),
  ]);
  return {
    reportsToday: r.count ?? 0,
    activeCampaigns: c.count ?? 0,
    domainsBlocked: d.count ?? 0,
    checksTotal: k.count ?? 0,
    ...summarizeChecks(pattern.data ?? []),
  };
});

export interface FeedFilters {
  institution?: string;
  /** Any of these imitated names (citizen "followed institutions"). */
  institutions?: string[];
  tactic?: string;
  status?: Enums<"campaign_status">;
  excludeStatus?: Enums<"campaign_status">;
  month?: string; // yyyy-mm
  since?: string;
}

function feedQuery(filters: FeedFilters, count = false) {
  const db = tryAdmin();
  if (!db) return null;
  let q = db.from("public_threat_feed").select("*", count ? { count: "exact" } : undefined).order("last_seen", { ascending: false, nullsFirst: false });
  if (filters.institution) q = q.eq("imitated_name", filters.institution);
  if (filters.institutions) q = q.in("imitated_name", filters.institutions);
  if (filters.tactic) q = q.eq("tactic", filters.tactic);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.excludeStatus) q = q.neq("status", filters.excludeStatus);
  if (filters.since) q = q.gte("last_seen", filters.since);
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    const [y, m] = filters.month.split("-").map(Number);
    const start = `${filters.month}-01`;
    const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    q = q.lte("first_seen", end).or(`last_seen.gte.${start},last_seen.is.null`);
  }
  return q;
}

type FeedRow = { code: string | null; tactic: string | null } & Omit<CampaignCardData, "code" | "tactic">;
const toCards = (rows: FeedRow[] | null): CampaignCardData[] =>
  (rows ?? []).flatMap((c) => (c.code && c.tactic ? [{ ...c, code: c.code, tactic: c.tactic }] : []));

/** Sanitized public threat feed (SPEC 5 public_threat_feed). No reporter data. */
export async function getThreatFeed(filters: FeedFilters = {}, limit = 200): Promise<CampaignCardData[]> {
  if (filters.institutions && !filters.institutions.length) return [];
  const q = feedQuery(filters);
  if (!q) return [];
  const { data } = await q.limit(limit);
  return toCards(data as FeedRow[] | null);
}

/** One page of the public feed plus the filtered total, for the /threats list. */
export async function getThreatFeedPage(filters: FeedFilters, page: number, size: number) {
  const q = feedQuery(filters, true);
  if (!q) return { rows: [] as CampaignCardData[], total: 0, page, pages: 1 };
  const { data, count } = await q.range(...pageRange(page, size));
  return { rows: toCards(data as FeedRow[] | null), total: count ?? 0, page, pages: pageCount(count, size) };
}

/** Whole-feed counters for the /threats overview: one grouped request (public_threat_feed_counts). */
export async function getThreatFeedCounts(): Promise<{ total: number; confirmed: number; takedown: number; resolved: number }> {
  const db = tryAdmin();
  if (!db) return { total: 0, confirmed: 0, takedown: 0, resolved: 0 };
  const { data } = await db.from("public_threat_feed_counts").select("status, n");
  const n = (s: string) => (data ?? []).find((r) => r.status === s)?.n ?? 0;
  return { total: (data ?? []).reduce((sum, r) => sum + (r.n ?? 0), 0), confirmed: n("confirmed"), takedown: n("takedown_in_progress"), resolved: n("resolved") };
}

export async function getFeedFacets(): Promise<{ institutions: string[]; tactics: string[]; months: string[] }> {
  const db = tryAdmin();
  if (!db) return { institutions: [], tactics: [], months: [] };
  // Only the four facet columns, not whole feed rows.
  const { data } = await db.from("public_threat_feed").select("imitated_name, tactic, first_seen, last_seen").limit(1000);
  const all = data ?? [];
  const months = new Set<string>();
  for (const c of all) {
    if (c.first_seen) months.add(c.first_seen.slice(0, 7));
    if (c.last_seen) months.add(c.last_seen.slice(0, 7));
  }
  return {
    institutions: [...new Set(all.map((c) => c.imitated_name).filter((x): x is string => !!x))].sort(),
    tactics: [...new Set(all.map((c) => c.tactic).filter((x): x is string => !!x))].sort(),
    months: [...months].sort().reverse(),
  };
}

export interface PublicCampaign extends CampaignCardData {
  sample: string | null;
  advisories: { slug: string; title_sq: string; title_en: string; body_sq: string; body_en: string; published_at: string | null }[];
  weekly: { week: string; count: number }[];
}

/** Public campaign page (SPEC 7 /threats/[code]): only campaigns in the public feed. */
export async function getPublicCampaign(code: string): Promise<PublicCampaign | null> {
  const db = tryAdmin();
  if (!db) return null;
  const { data: feed } = await db.from("public_threat_feed").select("*").eq("code", code).maybeSingle();
  if (!feed?.code || !feed.tactic) return null;
  const { data: camp } = await db.from("campaigns").select("id").eq("code", code).single();
  // Dates only for the weekly chart; the one sample body is fetched on its own.
  const [msgs, sample, adv] = await Promise.all([
    db.from("messages").select("received_at").eq("campaign_id", camp!.id).eq("label", "phishing").not("received_at", "is", null).order("received_at", { ascending: true }).limit(2000),
    db.from("messages").select("body_masked").eq("campaign_id", camp!.id).eq("label", "phishing").order("received_at", { ascending: true }).limit(1).maybeSingle(),
    db.from("advisories").select("slug, title_sq, title_en, body_sq, body_en, published_at").eq("campaign_id", camp!.id).eq("status", "published"),
  ]);
  const weeks = new Map<string, number>();
  for (const m of msgs.data ?? []) {
    if (!m.received_at) continue;
    const d = new Date(m.received_at);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    weeks.set(k, (weeks.get(k) ?? 0) + 1);
  }
  return {
    ...feed,
    code: feed.code,
    tactic: feed.tactic,
    sample: sample.data?.body_masked ?? null,
    advisories: adv.data ?? [],
    weekly: [...weeks.entries()].sort().map(([week, count]) => ({ week, count })),
  };
}

/** Real (masked) dataset messages for the example chips and the quiz. */
export async function getExampleMessages(limit = 4): Promise<{ text: string; label: Enums<"msg_label">; channel: Enums<"msg_channel">; sender: string | null }[]> {
  const db = tryAdmin();
  if (!db) return [];
  const { data } = await db
    .from("messages")
    .select("body_masked, label, channel, sender_masked")
    .eq("label", "phishing")
    .eq("source", "dataset")
    .not("campaign_id", "is", null)
    .limit(200);
  const rows = data ?? [];
  // deterministic spread across the set
  const step = Math.max(1, Math.floor(rows.length / limit));
  return rows
    .filter((_, i) => i % step === 0)
    .slice(0, limit)
    .map((m) => ({ text: m.body_masked, label: m.label, channel: m.channel, sender: m.sender_masked }));
}

export async function getQuizPool(): Promise<{ id: string; text: string; scam: boolean; channel: Enums<"msg_channel"> }[]> {
  const db = tryAdmin();
  if (!db) return [];
  const [p, l] = await Promise.all([
    db.from("messages").select("id, body_masked, channel").eq("label", "phishing").eq("source", "dataset").limit(60),
    db.from("messages").select("id, body_masked, channel").eq("label", "legitimate").eq("source", "dataset").limit(60),
  ]);
  return [
    ...(p.data ?? []).map((m) => ({ id: m.id, text: m.body_masked, scam: true, channel: m.channel })),
    ...(l.data ?? []).map((m) => ({ id: m.id, text: m.body_masked, scam: false, channel: m.channel })),
  ];
}

export interface DirectoryEntry {
  id: string;
  slug: string;
  name: string;
  sector: string;
  domains: string[];
  channels: { kind: string; value: string }[];
}

/** SPEC 7 /institutions: official domains, SMS senders and phone numbers. */
export async function getInstitutionDirectory(): Promise<DirectoryEntry[]> {
  const db = tryAdmin();
  if (!db) return [];
  const { data } = await db
    .from("institutions")
    .select("id, slug, name, sector, official_domains(domain, verified), official_channels(kind, value)")
    .order("name");
  return (data ?? []).map((i) => ({
    id: i.id,
    slug: i.slug,
    name: i.name,
    sector: i.sector,
    domains: (i.official_domains ?? []).filter((d) => d.verified).map((d) => d.domain),
    channels: (i.official_channels ?? []).map((c) => ({ kind: c.kind, value: c.value })),
  }));
}

export async function getLatestPublicCampaigns(n = 3): Promise<CampaignCardData[]> {
  return getThreatFeed({}, n);
}

export async function getPublicCheck(id: string) {
  const db = tryAdmin();
  if (!db) return null;
  const { data } = await db.from("checks").select("id, score, flag, reasons, created_at, campaigns(code)").eq("id", id).maybeSingle();
  return data;
}
