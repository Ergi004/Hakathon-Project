import { describe, expect, it } from "vitest";
import { assignCampaign, candidateCode, templateFingerprint, type CampaignRepo } from "../campaigns";

const F019 = { id: "c1", code: "F019", status: "confirmed" as const };

function repo(overrides: Partial<CampaignRepo> = {}): CampaignRepo {
  return {
    findByIoc: async () => null,
    findByBodyHash: async () => null,
    findSimilarBody: async () => null,
    findRelatedCampaign: async () => null,
    countUnlinkedByFingerprint: async () => 0,
    createCandidate: async () => ({ id: "new", code: candidateCode(2026, 1), status: "monitoring" }),
    ...overrides,
  };
}

const item = { iocs: [{ kind: "domain" as const, value: "x.example" }], maskedBody: "Paguani gjobën te [PHONE]", seenAt: new Date() };

describe("assignCampaign (SPEC 6.4)", () => {
  it("1. exact IoC match → known, confidence 1", async () => {
    expect(await assignCampaign(item, repo({ findByIoc: async () => F019 }))).toEqual({ id: "c1", code: "F019", matchType: "known", confidence: 1 });
  });

  it("2. trigram similarity → known with similarity as confidence", async () => {
    const r = await assignCampaign(item, repo({ findSimilarBody: async () => ({ ...F019, similarity: 0.87 }) }));
    expect(r).toMatchObject({ code: "F019", matchType: "known", confidence: 0.87 });
  });

  it("3. same institution, tactic and infrastructure → similar (suggestion only)", async () => {
    const r = await assignCampaign(
      { ...item, institutionId: "i", tactic: "parking_fine", registrar: "R" },
      repo({ findRelatedCampaign: async () => F019 }),
    );
    expect(r?.matchType).toBe("similar");
  });

  it("4. three items with one template in 48 h → new candidate", async () => {
    const r = await assignCampaign(item, repo({ countUnlinkedByFingerprint: async () => 2 }));
    expect(r).toMatchObject({ code: "C-2026-0001", matchType: "new_candidate" });
  });

  it("otherwise no campaign", async () => {
    expect(await assignCampaign(item, repo())).toBeNull();
  });

  it("template fingerprint ignores numbers, links and masks", () => {
    expect(templateFingerprint("Paguani 2500 lekë te a[.]example, tel [PHONE]")).toBe(
      templateFingerprint("Paguani 4000 lekë te b[.]example, tel [EMAIL]"),
    );
  });
});
