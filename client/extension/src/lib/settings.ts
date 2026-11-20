import type { ScanView, SentReport, Settings } from "./types";

const DEFAULTS: Settings = { autoSubmit: false, threshold: 40, deepScan: false };

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...((settings as Partial<Settings> | undefined) ?? {}) };
}
export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getSent(): Promise<SentReport[]> {
  const { sent } = await chrome.storage.local.get("sent");
  return Array.isArray(sent) ? (sent as SentReport[]) : [];
}
export async function addSent(r: SentReport): Promise<void> {
  await chrome.storage.local.set({ sent: [r, ...(await getSent())].slice(0, 20) });
}
export async function markUndone(reportId: string): Promise<void> {
  await chrome.storage.local.set({ sent: (await getSent()).map((s) => (s.reportId === reportId ? { ...s, undone: true } : s)) });
}

export async function setLast(view: ScanView): Promise<void> {
  await chrome.storage.local.set({ last: view });
}
export async function getLast(): Promise<ScanView | null> {
  const { last } = await chrome.storage.local.get("last");
  return (last as ScanView | undefined) ?? null;
}
