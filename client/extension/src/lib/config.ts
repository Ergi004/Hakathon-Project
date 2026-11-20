import type { Flag, ScanSummary, Settings } from "./types";

/** Replaced at build time (scripts/build-extension.mjs --api=…). */
declare const __DEFAULT_SERVER__: string;
export const DEFAULT_SERVER = typeof __DEFAULT_SERVER__ === "string" ? __DEFAULT_SERVER__ : "http://localhost:3000";

const HISTORY_MAX = 20;

export async function getSettings(): Promise<Settings> {
  const s = await chrome.storage.local.get(["server", "lang", "autoSubmit", "consentAt"]);
  return {
    server: (s.server as string | undefined) ?? DEFAULT_SERVER,
    lang: (s.lang as "sq" | "en" | undefined) ?? "sq",
    autoSubmit: s.autoSubmit === true,
    consentAt: (s.consentAt as string | undefined) ?? null,
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export async function getHistory(): Promise<ScanSummary[]> {
  return ((await chrome.storage.local.get("history")).history as ScanSummary[] | undefined) ?? [];
}

/** Insert or replace by scanId, newest first. */
export async function upsertHistory(item: ScanSummary): Promise<void> {
  const list = (await getHistory()).filter((h) => h.scanId !== item.scanId);
  await chrome.storage.local.set({ history: [item, ...list].slice(0, HISTORY_MAX), current: item.scanId });
}

/** Same thresholds as the platform (src/lib/flags.ts DEFAULT_THRESHOLDS). */
export function flagFor(risk: number | null | undefined, done: boolean): Flag {
  if (!done || risk === null || risk === undefined) return "grey";
  if (risk >= 80) return "darkred";
  if (risk >= 60) return "red";
  if (risk >= 40) return "orange";
  if (risk >= 20) return "yellow";
  return "green";
}

export const FLAG_COLOR: Record<Flag, string> = {
  green: "#16a34a",
  yellow: "#ca8a04",
  orange: "#ea580c",
  red: "#dc2626",
  darkred: "#7f1d1d",
  grey: "#6b7280",
};

/** Origin pattern for permissions.request / contains. */
export function originPattern(server: string): string {
  const u = new URL(server);
  return `${u.protocol}//${u.host}/*`;
}
