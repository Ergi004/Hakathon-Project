import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, toCsv, toGeoJson, type ExportRow } from "../export";

// Rows as they come from the stats layer, deliberately polluted with fields that must never leak.
const polluted = [
  { code: "AL0705", name: "Pogradec", county: "Korçë", observed: 46, prev: 3, rate: null, change: 14.3, z: 6.1, severity: "critical", lowData: false,
    body: "Paguani gjobën te hxxps://pogradec-fines-gov[.]al[.]example", protocol: "SOC-2026/000123", reporter_contact: "ana@mail.example", tracking_token: "tok_secret", centroid_lat: 40.9 },
  { code: "AL0706", name: "=HYPERLINK(\"x\")", county: "Korçë", observed: 2, prev: 0, rate: null, change: null, z: 1.9, severity: "watch", lowData: true, message: "secret text" },
] as unknown as ExportRow[];
const FORBIDDEN = ["Paguani", "pogradec-fines", "SOC-2026", "ana@mail", "tok_secret", "secret text", "centroid", "40.9"];

describe("exports contain aggregates only", () => {
  it("CSV has only whitelisted columns and no report text", () => {
    const csv = toCsv(polluted, { period: "2026-11-14 – 2026-11-20" });
    expect(csv.split("\n")[1]).toBe(EXPORT_COLUMNS.join(","));
    for (const f of FORBIDDEN) expect(csv).not.toContain(f);
  });
  it("low-data rows never carry a severity", () => {
    const csv = toCsv(polluted, {});
    expect(csv).toContain("AL0706");
    expect(csv.split("\n").find((l) => l.startsWith("AL0706"))).not.toContain("watch");
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv(polluted, {})).toContain(`"'=HYPERLINK(""x"")"`);
  });
  it("GeoJSON joins metrics to polygons with whitelisted properties only", () => {
    const features = [{ type: "Feature" as const, geometry: { type: "Point", coordinates: [20.65, 40.9] }, properties: { code: "AL0705", name: "Pogradec", secret: "x" } }];
    const gj = toGeoJson(features, polluted, { mode: "victim" });
    expect(Object.keys(gj.features[0].properties).sort()).toEqual([...EXPORT_COLUMNS].sort());
    expect(gj.features[0].properties).toMatchObject({ code: "AL0705", observed: 46, severity: "critical" });
    const text = JSON.stringify(gj.features[0].properties) + JSON.stringify(gj.metadata);
    for (const f of FORBIDDEN) expect(text).not.toContain(f);
  });
});
