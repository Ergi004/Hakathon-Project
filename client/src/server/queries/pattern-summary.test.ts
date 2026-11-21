import { describe, expect, it } from "vitest";
import { summarizePatternChecks, tiraneSlot, type PatternCheck } from "./pattern-summary";

const NOW = Date.parse("2026-11-21T12:30:00.000Z");

function check(partial: Partial<PatternCheck> & Pick<PatternCheck, "createdAt" | "scamType" | "brand">): PatternCheck {
  return {
    confidence: 0.8,
    features: {
      domain: { host: "posta-dergesa-al.example", tld: "example", lookalikeTarget: null, lookalikeClass: null, official: false, ageUnder30Days: null, oddTld: false, punycode: false, shortener: false },
      content: { urgency: null, payment: null, threat: null, secrets: null },
      infrastructure: { registrar: "QuickNames Shembull LLC", nameserver: "ns1.shembull.test", hostingCountry: "NL" },
      exfil: [],
      brands: [],
      themes: [],
      claimedPlace: "Tiranë",
      featureOverlap: null,
    },
    campaign: { id: "camp-1", code: "C-2026-9001" },
    ...partial,
  };
}

describe("summarizePatternChecks", () => {
  it("groups shared hosts and keeps unclassified checks out of the pattern list", () => {
    const report = summarizePatternChecks(
      [
        check({ createdAt: "2026-11-20T10:00:00.000Z", scamType: "parcel_postal_fee", brand: "postal" }),
        check({ createdAt: "2026-11-21T09:00:00.000Z", scamType: "parcel_postal_fee", brand: "postal" }),
        check({ createdAt: "2026-11-21T12:00:00.000Z", scamType: null, brand: null, features: null, campaign: null }),
        check({ createdAt: "2026-11-18T12:00:00.000Z", scamType: "other", brand: "other", features: null, campaign: null }),
      ],
      { now: NOW },
    );

    expect(report.coverage).toEqual({ classified: 2, other: 1, unclassified: 1 });
    expect(report.patterns).toHaveLength(2);
    expect(report.patterns[0]).toMatchObject({
      brand: "postal",
      scamType: "parcel_postal_fee",
      count: 2,
      reason: "shared_domain",
      evidence: "posta-dergesa-al.example",
      hostingCountry: "NL",
      claimedPlace: "Tiranë",
      active: true,
      campaigns: [{ id: "camp-1", code: "C-2026-9001" }],
    });
    expect(report.registrars).toEqual([{ name: "QuickNames Shembull LLC", value: 2 }]);
    expect(report.nameservers).toEqual([{ name: "ns1.shembull.test", value: 2 }]);
    expect(report.hosting).toEqual([{ name: "NL", value: 2 }]);
  });

  it("prefers a stored shared collection link over the domain", () => {
    const report = summarizePatternChecks(
      [
        check({
          createdAt: "2026-11-21T08:00:00.000Z",
          scamType: "fake_institution_login",
          brand: "e_albania",
          features: {
            domain: { host: "e-albania-perditesim.example" },
            content: {},
            infrastructure: { registrar: null, nameserver: null, hostingCountry: null },
            exfil: [{ kind: "telegram", url: "https://t.me/shembull-njoftime", endpoint: "t.me/shembull-njoftime" }],
            brands: [],
            themes: [],
            featureOverlap: { reason: "shared_exfil", evidence: "t.me/shembull-njoftime" },
          },
        }),
      ],
      { now: NOW, reason: "shared_exfil" },
    );
    expect(report.patterns[0]?.reason).toBe("shared_exfil");
    expect(report.patterns[0]?.evidence).toBe("t.me/shembull-njoftime");
  });

  it("counts the hour in Europe/Tirane", () => {
    expect(tiraneSlot("2026-11-21T12:00:00.000Z")).toEqual({ weekday: 5, hour: 13 });
    const report = summarizePatternChecks([check({ createdAt: "2026-11-21T12:00:00.000Z", scamType: "fake_bank", brand: "bank" })], { now: NOW });
    expect(report.heat[5][13]).toBe(1);
  });
});
