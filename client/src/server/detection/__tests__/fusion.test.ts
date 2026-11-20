import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS, flagForScore } from "@/lib/flags";
import { fuse } from "../fusion";
import { reason } from "../reasons";

const opts = { thresholds: DEFAULT_THRESHOLDS, floor: false, cap: false, analysed: true };

describe("fusion", () => {
  it("caps each group", () => {
    const r = fuse([reason("lookalike_homoglyph", 25), reason("domain_new", 10), reason("punycode", 8)], opts);
    expect(r.groups.links).toBe(30);
    expect(r.score).toBe(30);
    expect(r.flag).toBe("yellow");
  });

  it("applies the floor rule", () => {
    const r = fuse([reason("urgency", 4)], { ...opts, floor: true });
    expect(r.score).toBe(80);
    expect(r.flag).toBe("darkred");
  });

  it("applies the cap rule", () => {
    const r = fuse([reason("payment_lure", 4), reason("threat", 4), reason("classifier", 15)], { ...opts, cap: true });
    expect(r.score).toBeLessThanOrEqual(19);
    expect(r.flag).toBe("green");
  });

  it("never shows green for input that was not analysed", () => {
    const r = fuse([], { ...opts, analysed: false });
    expect(r.flag).toBe("grey");
  });

  it("maps default thresholds", () => {
    expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map((s) => flagForScore(s))).toEqual([
      "green", "green", "yellow", "yellow", "orange", "orange", "red", "red", "darkred", "darkred",
    ]);
  });

  it("sorts reasons by weight and keeps at most 8", () => {
    const many = ["urgency", "payment_lure", "threat", "asks_secrets", "punycode", "odd_tld", "shortener", "whois_privacy", "cert_fast"] as const;
    const r = fuse(many.map((c, i) => reason(c, i + 1)), opts);
    expect(r.reasons).toHaveLength(8);
    expect(r.reasons[0].weight).toBe(9);
  });
});
