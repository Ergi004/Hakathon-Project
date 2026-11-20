import { describe, expect, it } from "vitest";
import { scoreDomain, skeleton } from "../domain-score";
import { ctx, IDS } from "./fixtures";

const c = ctx();

describe("domain-score", () => {
  it("builds visual skeletons", () => {
    expect(skeleton("1ezhe")).toBe("lezhe");
    expect(skeleton("pogradеc")).toBe("pogradec"); // Cyrillic е
    expect(skeleton("bankashernbull")).toBe("bankashembull"); // rn → m
  });

  it("recognises official domains and their subdomains", () => {
    expect(scoreDomain("lezhe.gov.al.example", c).official?.institutionId).toBe(IDS.lezhe);
    expect(scoreDomain("pagesa.e-albania.al.example", c).official?.institutionId).toBe(IDS.ealbania);
  });

  it("flags the homoglyph 1ezhe-gov.al.example", () => {
    const f = scoreDomain("1ezhe-gov.al.example", c);
    expect(f.lookalike).toMatchObject({ cls: "homoglyph", institutionId: IDS.lezhe });
  });

  it("flags a shortened brand plus a scam word as combosquat", () => {
    expect(scoreDomain("posta-pagese.example", c).lookalike).toMatchObject({ cls: "combosquat", institutionId: IDS.posta });
    expect(scoreDomain("banka-login.example", c).lookalike).toMatchObject({ cls: "combosquat", institutionId: IDS.banka });
    expect(scoreDomain("posta.example", c).lookalike).toBeUndefined();
  });

  it("flags the combosquat pogradec-fines-gov.al.example", () => {
    expect(scoreDomain("pogradec-fines-gov.al.example", c).lookalike).toMatchObject({ cls: "combosquat", institutionId: IDS.pogradec });
  });

  it("flags punycode homoglyph xn--pogradc-dhg.al.test", () => {
    const f = scoreDomain("xn--pogradc-dhg.al.test", c);
    expect(f.punycode).toBe(true);
    expect(f.lookalike).toMatchObject({ cls: "homoglyph", institutionId: IDS.pogradec });
  });

  it("flags typosquats", () => {
    expect(scoreDomain("e-albnia.al.example", c).lookalike?.cls).toBe("typosquat");
    expect(scoreDomain("postashqiptar.al.example", c).lookalike?.cls).toBe("typosquat");
  });

  it("flags subdomain tricks", () => {
    expect(scoreDomain("e-albania.al.evil.example", c).lookalike?.cls).toBe("subdomain_trick");
  });

  it("flags shorteners and odd TLDs but not unrelated domains", () => {
    expect(scoreDomain("bit.ly", c).shortener).toBe(true);
    expect(scoreDomain("pako-dergesa.xyz", c).oddTld).toBe(true);
    const plain = scoreDomain("lajme.example", c);
    expect(plain.lookalike).toBeUndefined();
    expect(plain.official).toBeUndefined();
  });
});
