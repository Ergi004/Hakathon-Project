import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";

export const DATA_DIR = path.join(process.cwd(), "data", "s04");

export type Row = Record<string, string>;

export function dataFile(name: string): string {
  return path.join(DATA_DIR, name);
}

export function requireDataset(files: string[]): void {
  const missing = files.filter((f) => !existsSync(dataFile(f)));
  if (missing.length) {
    console.error(
      `Dataset not found: ${missing.join(", ")}\nPut the hackathon CSVs in ${DATA_DIR} (SPEC 14) and run again.`,
    );
    process.exit(1);
  }
}

export function readCsv(name: string): Row[] {
  const text = readFileSync(dataFile(name), "utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`${name}: CSV parse error on row ${first.row}: ${first.message}`);
  }
  return parsed.data;
}

/**
 * Resolve a column by its SPEC name or known aliases. The dataset columns are
 * only partly named in SPEC 14, so unknown headers fail loudly with the list.
 */
export function column(rows: Row[], file: string, aliases: string[], required = true): string | null {
  const headers = Object.keys(rows[0] ?? {});
  const lower = new Map(headers.map((h) => [h.toLowerCase(), h]));
  for (const a of aliases) {
    const hit = lower.get(a.toLowerCase());
    if (hit) return hit;
  }
  if (required) {
    throw new Error(`${file}: none of [${aliases.join(", ")}] found. Headers: ${headers.join(", ")}`);
  }
  return null;
}

export function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[;|,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function parseBool(value: string | undefined): boolean | null {
  if (value === undefined || value === "") return null;
  return /^(1|true|po|yes|y|on)$/i.test(value.trim());
}

export function parseIntOrNull(value: string | undefined): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
