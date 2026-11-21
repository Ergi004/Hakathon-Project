import { describe, expect, it } from "vitest";
import { analyzeRegions, DEFAULT_GEO_THRESHOLDS, expectedCounts, mergeZones, parseThresholds, rankHotspots, ruleMatches, severityOf, smooth, spikeRatio, zScore, type RegionInput } from "../hotspots";

const T = DEFAULT_GEO_THRESHOLDS;
const N = (o: Record<string, string[]>) => new Map(Object.entries(o));

describe("expected counts", () => {
  it("uses the baseline share when populations are missing", () => {
    const e = expectedCounts([{ code: "A", observed: 30, baseline: 75 }, { code: "B", observed: 10, baseline: 25 }]);
    expect(e.get("A")).toBe(30);
    expect(e.get("B")).toBe(10);
  });
  it("uses the population share when every region has one", () => {
    const e = expectedCounts([{ code: "A", observed: 10, baseline: 0, population: 300 }, { code: "B", observed: 30, baseline: 99, population: 100 }]);
    expect(e.get("A")).toBe(30);
    expect(e.get("B")).toBe(10);
  });
  it("falls back to an even share when there is no baseline at all", () => {
    const e = expectedCounts([{ code: "A", observed: 4, baseline: 0 }, { code: "B", observed: 0, baseline: 0 }]);
    expect(e.get("A")).toBe(2);
  });
});

describe("z-score", () => {
  it("is (o − e)/√e", () => expect(zScore(13, 4)).toBeCloseTo(4.5));
  it("guards tiny expected values with a 0.5 floor", () => {
    expect(zScore(3, 0)).toBeCloseTo((3 - 0.5) / Math.sqrt(0.5));
    expect(Number.isFinite(zScore(3, 0))).toBe(true);
  });
});

describe("spatial smoothing", () => {
  it("averages a region with half-weighted neighbours", () => {
    const s = smooth(new Map([["A", 10], ["B", 4], ["C", 2]]), N({ A: ["B", "C"], B: ["A"], C: ["A"] }));
    expect(s.get("A")).toBeCloseTo((10 + 0.5 * 6) / 2);
    expect(s.get("B")).toBeCloseTo((4 + 5) / 1.5);
  });
  it("ignores neighbours that are not in the data", () => {
    expect(smooth(new Map([["A", 6]]), N({ A: ["Z"] })).get("A")).toBe(6);
  });
});

describe("spike ratio", () => {
  it("compares per-day rates", () => expect(spikeRatio(14, 7, 28, 28)).toBe(2));
  it("guards a zero baseline", () => {
    expect(spikeRatio(5, 7, 0, 28)).toBe(Infinity);
    expect(spikeRatio(0, 7, 0, 28)).toBeNull();
  });
});

describe("severity bands", () => {
  it("critical needs count, z and spike", () => {
    expect(severityOf({ observed: 12, z: 3.5, spike: 4 }, T)).toBe("critical");
    expect(severityOf({ observed: 12, z: 3.5, spike: 2 }, T)).toBe("elevated");
  });
  it("elevated and watch", () => {
    expect(severityOf({ observed: 5, z: 2.1, spike: 1 }, T)).toBe("elevated");
    expect(severityOf({ observed: 3, z: 1.6, spike: 1 }, T)).toBe("watch");
    expect(severityOf({ observed: 4, z: 1.2, spike: 9 }, T)).toBeNull();
  });
  it("thresholds come from settings and never drop below 3 reports", () => {
    const t = parseThresholds({ watch: { minObserved: 1, minZ: 0 } });
    expect(t.watch.minObserved).toBe(3);
    expect(severityOf({ observed: 2, z: 9, spike: 9 }, t)).toBeNull();
    expect(parseThresholds({ elevated: { minObserved: 8, minZ: 2 } }).elevated.minObserved).toBe(8);
  });
});

describe("analysis, suppression and zones", () => {
  // A small country: P (spiking) borders Q (also hot) and R; S is far away and quiet.
  const neighbors = N({ P: ["Q", "R"], Q: ["P"], R: ["P"], S: [] });
  const regions: RegionInput[] = [
    { code: "P", observed: 20, baseline: 8 },
    { code: "Q", observed: 9, baseline: 8 },
    { code: "R", observed: 2, baseline: 40 },
    { code: "S", observed: 9, baseline: 120 },
  ];
  const res = analyzeRegions(regions, neighbors, T);
  const by = Object.fromEntries(res.map((r) => [r.code, r]));

  it("flags the spiking region critical", () => {
    expect(by.P.severity).toBe("critical");
    expect(by.P.spike).toBeGreaterThanOrEqual(3);
  });
  it("suppresses fewer than 3 reports: low data, never ranked", () => {
    expect(by.R.lowData).toBe(true);
    expect(by.R.severity).toBeNull();
    expect(rankHotspots(res).map((r) => r.code)).not.toContain("R");
  });
  it("ranks critical first", () => {
    expect(rankHotspots(res)[0].code).toBe("P");
  });
  it("merges adjacent elevated/critical regions into one zone named after the largest", () => {
    const zones = mergeZones(res, neighbors);
    expect(by.Q.severity).toMatch(/elevated|critical/);
    expect(zones[0]).toMatchObject({ code: "P", severity: "critical" });
    expect(zones[0].members.sort()).toEqual(["P", "Q"]);
    expect(zones.some((z) => z.members.includes("S"))).toBe(false);
  });
});

describe("alert rules", () => {
  const hot = { code: "P", observed: 12, expected: 2, z: 4, smoothed: 8, spike: 5, lowData: false, severity: "critical" as const };
  it("matches by thresholds, institution and region", () => {
    expect(ruleMatches({ minReports: 5, minZ: 2, minSpike: 3 }, hot, null)).toBe(true);
    expect(ruleMatches({ minReports: 5, minZ: 2, minSpike: 3, institutionId: "i1" }, hot, "i2")).toBe(false);
    expect(ruleMatches({ minReports: 5, minZ: 2, minSpike: 3, regionCode: "Q" }, hot, null)).toBe(false);
  });
  it("never alerts on low data or watch-level regions", () => {
    expect(ruleMatches({ minReports: 0, minZ: 0, minSpike: 0 }, { ...hot, observed: 2, lowData: true, severity: null }, null)).toBe(false);
    expect(ruleMatches({ minReports: 0, minZ: 0, minSpike: 0 }, { ...hot, severity: "watch" }, null)).toBe(false);
  });
});
