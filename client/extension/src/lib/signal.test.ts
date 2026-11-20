import { describe, expect, it } from "vitest";
import { signalReportSchema } from "../../../src/lib/schemas/extension";
import type { Report } from "./api";
import { autoMode, buildSignal, indicatorsOnly } from "./signal";

const report: Report = {
  verdict: "malicious",
  riskScore: 88.4,
  severity: "high",
  evidence: {
    engineReasons: [
      { code: "lookalike_typosquat", text_sq: "", text_en: "", weight: 20 },
      { code: "official_domain", text_sq: "", text_en: "", weight: 0 },
    ],
    findings: [{ code: "dmarc_fail" }, { code: "reply_to_mismatch" }],
    email: {
      subject: "Llogaria e Ana Hoxha do të bllokohet",
      from: "BKT Siguria <siguria@bkt-verifikim.al.test>",
      authentication: { spf: "softfail", dkim: "none", dmarc: "fail", source: "authentication-results" },
      attachments: [{ name: "fatura.pdf.exe", mime: "application/x-msdownload" }],
      excerpt: "Shkruani te ana.hoxha@gmail.com ose telefononi +355 69 123 4567. IBAN AL47212110090000000235698741. " + "x".repeat(800),
    },
  },
  iocs: [
    { type: "url", value: "hxxps://bkt-verifikim[.]al[.]test/hyr" },
    { type: "domain", value: "bkt-verifikim[.]al[.]test" },
  ],
  reputation: { results: [] },
  classification: { phishingType: [], phishingFamily: [] },
  recommendedActions: [],
};

describe("signal reports (SPEC 12.2)", () => {
  it("auto-submit policy: orange/red/darkred full, yellow indicators only, green/grey nothing", () => {
    expect(["orange", "red", "darkred"].map((f) => autoMode(f as "red"))).toEqual(["full", "full", "full"]);
    expect(autoMode("yellow")).toBe("indicators");
    expect(autoMode("green")).toBe("none");
    expect(autoMode("grey")).toBe("none");
  });

  it("full report is masked, bounded and accepted by the server's schema", () => {
    const s = buildSignal(report, "darkred", "0.2.0", "full");
    expect(s.bodyExcerpt).not.toMatch(/ana\.hoxha|691234567|AL4721/);
    expect(s.bodyExcerpt!.length).toBeLessThanOrEqual(600);
    expect(s.senderDomain).toBe("bkt-verifikim.al.test");
    expect(s.auth).toEqual({ spf: "fail", dkim: "none", dmarc: "fail" });
    expect(s.urls).toEqual(["hxxps://bkt-verifikim[.]al[.]test/hyr"]);
    expect(s.reasonCodes).toEqual(["lookalike_typosquat", "dmarc_fail", "reply_to_mismatch"]);
    expect(s.score).toBe(88);
    expect(signalReportSchema.safeParse(s).success).toBe(true);
  });

  it("indicators-only report carries no subject, text or attachment names", () => {
    const s = indicatorsOnly(buildSignal(report, "yellow", "0.2.0", "full"));
    expect(s).not.toHaveProperty("subject");
    expect(s).not.toHaveProperty("bodyExcerpt");
    expect(s.attachments).toEqual([]);
    expect(s.indicatorsOnly).toBe(true);
    expect(s.urls.length).toBe(1);
    expect(signalReportSchema.safeParse(s).success).toBe(true);
    expect(buildSignal(report, "yellow", "0.2.0", "indicators")).toEqual(s);
  });

  it("SMS reports are labelled as SMS and never carry a sender domain", () => {
    const sms: Report = { ...report, evidence: { engineReasons: [], findings: [], sms: { sender: "+355690000000", excerpt: "Paguani tarifën te +355 69 000 0000" } } };
    const s = buildSignal(sms, "red", "0.2.0", "full");
    expect(s.channel).toBe("sms");
    expect(s.senderDomain).toBeUndefined();
    expect(s.bodyExcerpt).not.toMatch(/69 000 0000/);
    expect(signalReportSchema.safeParse(s).success).toBe(true);
  });
});
