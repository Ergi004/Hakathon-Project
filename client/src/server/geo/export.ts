/**
 * Export builders for /soc/geo. Pure: aggregates only, never report text, contacts or tokens.
 * (Unit tested: the output is built from an explicit whitelist of numeric/name columns.)
 */
export interface ExportRow {
  code: string;
  name: string;
  county: string;
  observed: number;
  prev: number;
  rate: number | null;
  change: number | null;
  z: number;
  severity: string | null;
  lowData: boolean;
}

export const EXPORT_COLUMNS = ["code", "name", "county", "observed", "prev", "rate", "change", "z", "severity", "lowData"] as const;

function pick(r: ExportRow): ExportRow {
  // Whitelist: whatever extra fields an object carries are dropped here.
  return {
    code: String(r.code), name: String(r.name), county: String(r.county),
    observed: Number(r.observed) || 0, prev: Number(r.prev) || 0,
    rate: r.rate === null ? null : +Number(r.rate).toFixed(2),
    change: r.change === null ? null : +Number(r.change).toFixed(3),
    z: +Number(r.z).toFixed(2), severity: r.lowData ? null : r.severity, lowData: !!r.lowData,
  };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows: ExportRow[], meta: Record<string, string>): string {
  const head = Object.entries(meta).map(([k, v]) => `# ${k}: ${v.replace(/\n/g, " ")}`);
  const body = rows.map(pick).map((r) => EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [...head, EXPORT_COLUMNS.join(","), ...body].join("\n") + "\n";
}

export interface GeoFeature { type: "Feature"; geometry: unknown; properties: Record<string, unknown> | null }

/** Joins the metrics to the municipality polygons. Only code + whitelisted metrics are kept. */
export function toGeoJson(features: GeoFeature[], rows: ExportRow[], meta: Record<string, string>) {
  const byCode = new Map(rows.map((r) => [r.code, pick(r)]));
  return {
    type: "FeatureCollection" as const,
    metadata: meta,
    features: features.map((f) => {
      const code = String(f.properties?.code ?? "");
      return { type: "Feature" as const, geometry: f.geometry, properties: { ...(byCode.get(code) ?? { code }) } };
    }),
  };
}
