import { describe, expect, it } from "vitest";
import { analyze, PATTERN, type PatternMatch } from "../index";
import { ctx } from "./fixtures";

const FINE_SMS =
  "Bashkia Lezhë: Keni një gjobë parkimi të papaguar. Paguani sot brenda 24 orëve në 1ezhe-gov[.]al[.]example për të shmangur dyfishimin.";
const input = { kind: "text" as const, channel: "sms" as const, locale: "sq" as const, sender: "+355 69 000 0000", text: FINE_SMS };
const match = (similarity: number, status: PatternMatch["status"] = "confirmed"): PatternMatch => ({ id: "camp-1", code: "C-2026-0042", status, similarity });

describe("analyze: text-pattern campaign matching", () => {
  it("shows a similar campaign and adds the campaign_pattern reason for a strong match to a confirmed campaign", async () => {
    const base = await analyze(input, ctx(), { model: null });
    const r = await analyze(input, ctx(), { model: null, patternMatch: async () => match(0.82) });
    expect(r.campaign).toEqual({ id: "camp-1", code: "C-2026-0042", matchType: "similar", confidence: 0.82 });
    expect(r.reasons.find((x) => x.code === "campaign_pattern")?.evidence).toBe("C-2026-0042");
    expect(r.score).toBeGreaterThanOrEqual(base.score);
  });

  it("shows but does not score a match between the show and signal thresholds", async () => {
    const r = await analyze(input, ctx(), { model: null, patternMatch: async () => match((PATTERN.show + PATTERN.signal) / 2) });
    expect(r.campaign?.matchType).toBe("similar");
    expect(r.reasons.map((x) => x.code)).not.toContain("campaign_pattern");
  });

  it("does not score a match to a campaign still being monitored", async () => {
    const r = await analyze(input, ctx(), { model: null, patternMatch: async () => match(0.9, "monitoring") });
    expect(r.campaign?.code).toBe("C-2026-0042");
    expect(r.reasons.map((x) => x.code)).not.toContain("campaign_pattern");
  });

  it("ignores weak matches and lookup failures", async () => {
    const weak = await analyze(input, ctx(), { model: null, patternMatch: async () => match(0.3) });
    expect(weak.campaign).toBeUndefined();
    const failing = await analyze(input, ctx(), { model: null, patternMatch: async () => { throw new Error("db down"); } });
    expect(failing.campaign).toBeUndefined();
    expect(failing.flag).toBe("red");
  });

  it("is never called for a phone number", async () => {
    let called = false;
    await analyze({ kind: "phone", channel: "call", locale: "sq", text: "+355 69 123 4567" }, ctx(), { model: null, patternMatch: async () => { called = true; return null; } });
    expect(called).toBe(false);
  });
});

describe("analyze: per-indicator breakdown", () => {
  it("rates each domain on its own and lists phones and emails", async () => {
    const r = await analyze(
      {
        kind: "text", channel: "email", locale: "sq", sender: "Bashkia <info@lezhe.gov.al.example>",
        text: `${FINE_SMS} Informacion zyrtar: https://lezhe.gov.al.example/gjoba. Telefononi +355 69 765 4321 ose shkruani te ndihma@mail-falas.example`,
      },
      ctx(),
      { model: null },
    );
    const byHost = Object.fromEntries(r.indicators.domains.map((d) => [d.value, d]));
    const fake = byHost["1ezhe-gov[.]al[.]example"];
    expect(fake.level === "high" || fake.level === "suspicious").toBe(true);
    expect(fake.lookalike?.cls).toBe("homoglyph");
    expect(fake.signals).toContain("lookalike_homoglyph");
    expect(byHost["lezhe[.]gov[.]al[.]example"].level).toBe("official");
    expect(byHost["lezhe[.]gov[.]al[.]example"].risk).toBe(0);
    // Riskiest domain first.
    expect(r.indicators.domains[0].value).toBe("1ezhe-gov[.]al[.]example");
    expect(r.indicators.phones.length).toBeGreaterThan(0);
    expect(r.indicators.emails.map((e) => e.value)).toContain("ndihma@mail-falas[.]example");
  });
});
