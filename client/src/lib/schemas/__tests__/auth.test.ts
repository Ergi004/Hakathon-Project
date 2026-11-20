import { describe, expect, it } from "vitest";
import { orgSlug, pendingOrgSchema, safeNextPath, signUpSchema } from "../auth";

const citizen = {
  accountType: "citizen",
  email: "qytetar@demo.example",
  password: "fjalekalim-i-gjate",
  confirmPassword: "fjalekalim-i-gjate",
  acceptTerms: true,
};

const issues = (input: unknown) =>
  signUpSchema.safeParse(input).error?.issues.map((i) => i.path.join(".")) ?? [];

describe("signUpSchema", () => {
  it("accepts a citizen without name or organization", () => {
    expect(signUpSchema.safeParse(citizen).success).toBe(true);
  });

  it("requires organization and name for a business", () => {
    expect(issues({ ...citizen, accountType: "business" })).toEqual(expect.arrayContaining(["orgName", "fullName"]));
    expect(signUpSchema.safeParse({ ...citizen, accountType: "business", orgName: "Banka Demo", fullName: "Pronar Demo" }).success).toBe(true);
  });

  it("rejects staff roles: only citizen and business exist", () => {
    expect(issues({ ...citizen, accountType: "soc_analyst" })).toContain("accountType");
  });

  it("rejects mismatched or short passwords and unaccepted terms", () => {
    expect(issues({ ...citizen, confirmPassword: "tjeter-fjalekalim" })).toContain("confirmPassword");
    expect(issues({ ...citizen, password: "short", confirmPassword: "short" })).toContain("password");
    expect(issues({ ...citizen, acceptTerms: false })).toContain("acceptTerms");
  });

  it("rejects an invalid email", () => {
    expect(issues({ ...citizen, email: "jo-email" })).toContain("email");
  });
});

describe("helpers", () => {
  it("builds ASCII slugs with a suffix", () => {
    expect(orgSlug("Banka e Shqipërisë Çmimi", "a1b2c3")).toBe("banka-e-shqiperise-cmimi-a1b2c3");
    expect(orgSlug("!!!", "ff0011")).toBe("org-ff0011");
  });

  it("validates the pending organization marker", () => {
    expect(pendingOrgSchema.safeParse({ name: "Banka Demo" }).success).toBe(true);
    expect(pendingOrgSchema.safeParse({ name: "" }).success).toBe(false);
    expect(pendingOrgSchema.safeParse(null).success).toBe(false);
  });

  it("only allows locale-prefixed redirect paths", () => {
    expect(safeNextPath.parse("/sq/business")).toBe("/sq/business");
    expect(safeNextPath.parse("https://evil.example")).toBeUndefined();
    expect(safeNextPath.parse("//evil.example")).toBeUndefined();
  });
});
