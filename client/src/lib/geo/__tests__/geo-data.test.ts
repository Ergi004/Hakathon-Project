import { describe, expect, it } from "vitest";
import hexLayout from "../../../../public/geo/hex-layout.json";
import { applyStatsFilters, filtersToQuery, parseGeoFilters, resolveWindow, type FilterableQuery } from "../filters";
import { hexDistance } from "../hex";
import { COUNTIES, isMunicipalityCode, MUNICIPALITIES, municipalitiesOf, NEIGHBORS, REGION_BY_CODE, regionName } from "../regions";

describe("regions (OCHA COD-AB 2019)", () => {
  it("has exactly 12 counties and 61 municipalities with unique codes", () => {
    expect(COUNTIES).toHaveLength(12);
    expect(MUNICIPALITIES).toHaveLength(61);
    expect(new Set(MUNICIPALITIES.map((m) => m.code)).size).toBe(61);
  });
  it("every municipality belongs to an existing county", () => {
    for (const m of MUNICIPALITIES) expect(REGION_BY_CODE.get(m.parent_code!)?.level).toBe("county");
    expect(COUNTIES.reduce((s, c) => s + municipalitiesOf(c.code).length, 0)).toBe(61);
  });
  it("looks up names and codes", () => {
    expect(regionName("AL0705", "sq")).toBe("Pogradec");
    expect(regionName("AL1101", "sq")).toBe("Kamëz");
    expect(regionName("AL1105", "en")).toBe("Tirana");
    expect(isMunicipalityCode("AL0705")).toBe(true);
    expect(isMunicipalityCode("AL07")).toBe(false);
    expect(isMunicipalityCode("XX9999")).toBe(false);
  });
  it("neighbours are symmetric and every municipality has at least one", () => {
    for (const [code, ns] of NEIGHBORS) {
      expect(ns.length).toBeGreaterThan(0);
      for (const n of ns) expect(NEIGHBORS.get(n)).toContain(code);
    }
    expect(NEIGHBORS.get("AL0705")).toEqual(expect.arrayContaining(["AL0704", "AL0706"]));
  });
});

describe("hex layout", () => {
  const cells = (hexLayout as { cells: Record<string, { q: number; r: number }> }).cells;
  it("places all 61 municipalities", () => {
    expect(Object.keys(cells).sort()).toEqual(MUNICIPALITIES.map((m) => m.code).sort());
  });
  it("no two municipalities share a hex", () => {
    expect(new Set(Object.values(cells).map((c) => `${c.q},${c.r}`)).size).toBe(61);
  });
  it("keeps Pogradec next to at least one real neighbour", () => {
    expect(NEIGHBORS.get("AL0705")!.some((n) => hexDistance(cells.AL0705, cells[n]) === 1)).toBe(true);
  });
});

describe("filters", () => {
  it("parses URL params with safe fallbacks", () => {
    const f = parseGeoFilters({ range: "30d", mode: "imitated", campaign: "F019", minFlag: "red", confirmed: "1", layers: "hex,zones,bogus", metric: "nope", tactic: "DROP TABLE" });
    expect(f).toMatchObject({ range: "30d", mode: "imitated", campaign: "F019", minFlag: "red", confirmed: true, layers: ["hex", "zones"], metric: "count", tactic: undefined });
    expect(parseGeoFilters({})).toMatchObject({ range: "7d", mode: "victim", confirmed: false, compare: false, view: "map" });
  });
  it("round-trips through the query string", () => {
    const f = parseGeoFilters({ range: "30d", campaign: "F019", compare: "1", view: "table" });
    expect(parseGeoFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
    expect(filtersToQuery(parseGeoFilters({}))).toBe("");
  });
  it("resolves whole-day windows, previous period and baseline", () => {
    const w = resolveWindow({ range: "7d" }, "2026-11-20", 28);
    expect(w).toMatchObject({ from: "2026-11-14", to: "2026-11-20", prevFrom: "2026-11-07", prevTo: "2026-11-13", baselineFrom: "2026-10-17" });
    expect(w.days).toHaveLength(7);
    expect(resolveWindow({ range: "24h" }, "2026-11-20").days).toEqual(["2026-11-20"]);
    expect(resolveWindow({ range: "custom", from: "2026-11-01", to: "2026-12-31" }, "2026-11-20").to).toBe("2026-11-20");
  });

  it("maps every filter to the right SQL conditions", () => {
    const calls: [string, string, unknown][] = [];
    const q: FilterableQuery<unknown> & Record<string, unknown> = {
      eq: (c, v) => (calls.push(["eq", c, v]), q),
      in: (c, v) => (calls.push(["in", c, v]), q),
      gte: (c, v) => (calls.push(["gte", c, v]), q),
      lte: (c, v) => (calls.push(["lte", c, v]), q),
    };
    const f = parseGeoFilters({ mode: "imitated", institution: "6f1c1b5e-0000-4000-8000-000000000001", tactic: "parking_fine_qr", campaign: "F019", channel: "qr", minFlag: "red", source: "citizen", confirmed: "1" });
    applyStatsFilters(q as never, f, { from: "2026-11-14", to: "2026-11-20", campaignId: "c-1" });
    expect(calls).toEqual([
      ["eq", "mode", "imitated"],
      ["gte", "day", "2026-11-14"],
      ["lte", "day", "2026-11-20"],
      ["eq", "institution_id", "6f1c1b5e-0000-4000-8000-000000000001"],
      ["eq", "tactic", "parking_fine_qr"],
      ["eq", "campaign_id", "c-1"],
      ["eq", "channel", "qr"],
      ["in", "flag", ["red", "darkred"]],
      ["in", "source", ["citizen_report", "citizen_check"]],
      ["eq", "confirmed", true],
    ]);
  });
  it("an unknown campaign code matches nothing instead of everything", () => {
    const calls: [string, unknown][] = [];
    const q = { eq: (c: string, v: unknown) => (calls.push([c, v]), q), in: () => q, gte: () => q, lte: () => q };
    applyStatsFilters(q as never, parseGeoFilters({ campaign: "NOPE" }), { from: "a", to: "b", campaignId: null });
    expect(calls).toContainEqual(["campaign_id", "00000000-0000-0000-0000-000000000000"]);
  });
});
