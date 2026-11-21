import type { BrandCategory, ScamType } from "@/server/detection/pattern";
import { readClaimedPlace, readHostingCountry, readScamFeatures } from "@/server/detection/stored-features";

export const PATTERN_WINDOWS = [7, 30, 90] as const;
export type PatternWindow = (typeof PATTERN_WINDOWS)[number];

export const PATTERN_KINDS = ["text", "url", "email_signals", "phone", "qr"] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

export const PATTERN_REASONS = ["shared_exfil", "shared_url", "shared_domain"] as const;
export type PatternReason = (typeof PATTERN_REASONS)[number];

const ACTIVE_MS = 7 * 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface PatternCheck {
  createdAt: string;
  scamType: string | null;
  brand: string | null;
  confidence: number | null;
  features: unknown;
  campaign: { id: string; code: string } | null;
}

export interface PatternDrill {
  brand?: BrandCategory;
  scamType?: ScamType;
  reason?: PatternReason;
  registrar?: string;
  weekday?: number;
  hour?: number;
  now?: number;
}

export interface PatternRow {
  key: string;
  brand: string;
  scamType: string;
  count: number;
  confidence: number | null;
  firstSeen: string;
  lastSeen: string;
  hostingCountry: string | null;
  claimedPlace: string | null;
  reason: PatternReason | null;
  evidence: string | null;
  campaigns: { id: string; code: string }[];
  active: boolean;
}

export interface PatternReport {
  coverage: { classified: number; other: number; unclassified: number };
  patterns: PatternRow[];
  byBrand: { name: string; value: number }[];
  byScamType: { name: string; value: number }[];
  byReason: { name: string; value: number }[];
  registrars: { name: string; value: number }[];
  nameservers: { name: string; value: number }[];
  hosting: { name: string; value: number }[];
  heat: number[][];
  brands: string[];
  scamTypes: string[];
  reasons: PatternReason[];
  registrarNames: string[];
}

export function asPatternReason(value: string | null | undefined): PatternReason | null {
  switch (value) {
    case "shared_exfil":
    case "shared_url":
    case "shared_domain":
      return value;
    default:
      return null;
  }
}

export function asPatternWindow(value: string | null | undefined): PatternWindow {
  switch (value) {
    case "7":
      return 7;
    case "30":
      return 30;
    case "90":
      return 90;
    default:
      return 90;
  }
}

export function asPatternKind(value: string | null | undefined): PatternKind | undefined {
  switch (value) {
    case "text":
    case "url":
    case "email_signals":
    case "phone":
    case "qr":
      return value;
    default:
      return undefined;
  }
}

/** Weekday (Monday = 0) and hour in Europe/Tirane. */
export function tiraneSlot(iso: string): { weekday: number; hour: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Tirane", weekday: "short" }).format(date);
  const hourText = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Tirane", hour: "2-digit", hourCycle: "h23" }).format(date);
  const weekday = WEEKDAYS.indexOf(weekdayName as (typeof WEEKDAYS)[number]);
  const hour = Number(hourText);
  if (weekday < 0 || !Number.isInteger(hour)) return null;
  return { weekday, hour: hour === 24 ? 0 : hour };
}

function readOverlap(features: unknown): { reason: PatternReason; evidence: string } | null {
  if (!features || typeof features !== "object" || Array.isArray(features)) return null;
  const overlap = (features as { featureOverlap?: unknown }).featureOverlap;
  if (!overlap || typeof overlap !== "object" || Array.isArray(overlap)) return null;
  const reason = asPatternReason(typeof (overlap as { reason?: unknown }).reason === "string" ? (overlap as { reason: string }).reason : null);
  const evidence = (overlap as { evidence?: unknown }).evidence;
  if (!reason || typeof evidence !== "string" || !evidence.trim()) return null;
  return { reason, evidence: evidence.trim().slice(0, 180) };
}

function connectionOf(features: unknown): { reason: PatternReason; evidence: string } | null {
  const overlap = readOverlap(features);
  if (overlap) return overlap;
  const host = readScamFeatures(features)?.domain.host?.trim();
  if (!host) return null;
  return { reason: "shared_domain", evidence: host };
}

function infraName(features: unknown, key: "registrar" | "nameserver"): string | null {
  const value = readScamFeatures(features)?.infrastructure[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ranked(map: Map<string, number>, limit: number): { name: string; value: number }[] {
  return [...map.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function bump(map: Map<string, number>, key: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mode(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) bump(counts, value);
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function matches(row: PatternCheck, filters: PatternDrill): boolean {
  if (filters.brand && row.brand !== filters.brand) return false;
  if (filters.scamType && row.scamType !== filters.scamType) return false;
  const link = connectionOf(row.features);
  if (filters.reason && link?.reason !== filters.reason) return false;
  if (filters.registrar && infraName(row.features, "registrar") !== filters.registrar) return false;
  if (filters.weekday === undefined && filters.hour === undefined) return true;
  const slot = tiraneSlot(row.createdAt);
  if (!slot) return false;
  if (filters.weekday !== undefined && slot.weekday !== filters.weekday) return false;
  if (filters.hour !== undefined && slot.hour !== filters.hour) return false;
  return true;
}

/** Group classified checks into repeating patterns. Message text is never read. */
export function summarizePatternChecks(rows: PatternCheck[], filters: PatternDrill = {}): PatternReport {
  const now = filters.now ?? Date.now();
  const coverage = { classified: 0, other: 0, unclassified: 0 };
  for (const row of rows) {
    if (!row.scamType) coverage.unclassified += 1;
    else if (row.scamType === "other") coverage.other += 1;
    else coverage.classified += 1;
  }

  const classified = rows.filter((row) => row.scamType);
  const facetBrand = new Map<string, number>();
  const facetType = new Map<string, number>();
  const facetReason = new Map<string, number>();
  const facetRegistrar = new Map<string, number>();
  for (const row of classified) {
    bump(facetBrand, row.brand);
    bump(facetType, row.scamType);
    bump(facetReason, connectionOf(row.features)?.reason ?? null);
    bump(facetRegistrar, infraName(row.features, "registrar"));
  }

  const selected = classified.filter((row) => matches(row, filters));
  const byBrand = new Map<string, number>();
  const byScamType = new Map<string, number>();
  const byReason = new Map<string, number>();
  const registrars = new Map<string, number>();
  const nameservers = new Map<string, number>();
  const hosting = new Map<string, number>();
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const groups = new Map<string, PatternCheck[]>();

  for (const row of selected) {
    bump(byBrand, row.brand);
    bump(byScamType, row.scamType);
    const link = connectionOf(row.features);
    bump(byReason, link?.reason ?? null);
    bump(registrars, infraName(row.features, "registrar"));
    bump(nameservers, infraName(row.features, "nameserver"));
    bump(hosting, readHostingCountry(row.features));
    const slot = tiraneSlot(row.createdAt);
    if (slot) heat[slot.weekday][slot.hour] += 1;
    const key = `${row.brand ?? "unknown"}|${row.scamType}|${link?.reason ?? "none"}|${link?.evidence ?? "none"}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const patterns = [...groups.entries()]
    .map(([key, list]) => {
      const times = list.map((row) => row.createdAt).sort();
      const link = connectionOf(list[0]?.features);
      const scores = list.map((row) => row.confidence).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const campaigns = new Map<string, { id: string; code: string }>();
      for (const row of list) {
        if (row.campaign) campaigns.set(row.campaign.id, row.campaign);
      }
      const lastSeen = times[times.length - 1] ?? list[0]?.createdAt ?? "";
      return {
        key,
        brand: list[0]?.brand ?? "other",
        scamType: list[0]?.scamType ?? "other",
        count: list.length,
        confidence: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 100) / 100 : null,
        firstSeen: times[0] ?? lastSeen,
        lastSeen,
        hostingCountry: mode(list.map((row) => readHostingCountry(row.features))),
        claimedPlace: mode(list.map((row) => readClaimedPlace(row.features))),
        reason: link?.reason ?? null,
        evidence: link?.evidence ?? null,
        campaigns: [...campaigns.values()].sort((a, b) => a.code.localeCompare(b.code)).slice(0, 6),
        active: Number.isFinite(Date.parse(lastSeen)) && now - Date.parse(lastSeen) <= ACTIVE_MS,
      } satisfies PatternRow;
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, 40);

  return {
    coverage,
    patterns,
    byBrand: ranked(byBrand, 10),
    byScamType: ranked(byScamType, 8),
    byReason: ranked(byReason, 4),
    registrars: ranked(registrars, 10),
    nameservers: ranked(nameservers, 10),
    hosting: ranked(hosting, 10),
    heat,
    brands: ranked(facetBrand, 12).map((row) => row.name),
    scamTypes: ranked(facetType, 8).map((row) => row.name),
    reasons: PATTERN_REASONS.filter((reason) => (facetReason.get(reason) ?? 0) > 0),
    registrarNames: ranked(facetRegistrar, 12).map((row) => row.name),
  };
}
