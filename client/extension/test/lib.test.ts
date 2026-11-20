import { describe, expect, it } from "vitest";
import { analyzeLocal, flagFor, mismatchedLinks } from "../src/lib/analyze-local";
import { defang, mask, maskKeepingUrls, stripQuery } from "../src/lib/mask";
import { combineScore, decide, toAnalysisInput, toSignals } from "../src/lib/pipeline";
import { unwrapRedirect } from "../src/content/dom";
import type { ExtractedEmail } from "../src/lib/types";

const email: ExtractedEmail = {
  client: "gmail",
  subject: "Gjobë e papaguar për Ana Hoxha 0691234567",
  sender: "noreply@pogradec-fines-gov.al.example",
  text: "I nderuar Arben Krasniqi,\nKeni një gjobë të papaguar. Paguani menjëherë te https://pogradec-fines-gov.al.example/pay?email=ana@mail.com brenda 24 orëve.\nIBAN AL47 2121 1009 0000 0002 3569 8741, tel +355 69 123 4567, ID J12345678K.",
  links: [{ href: "https://pogradec-fines-gov.al.example/pay?email=ana@mail.com#x", text: "e-albania.al" }],
  attachments: [{ name: "fatura.docm", mime: "application/vnd.ms-word.document.macroEnabled.12" }],
};

describe("mask", () => {
  it("masks emails, IBANs, phones, IDs and names after a salutation", () => {
    const m = mask(email.text);
    expect(m).not.toMatch(/ana@mail\.com|AL47|\+355 69|J12345678K|Arben/);
    expect(m).toContain("[EMAIL]");
    expect(m).toContain("[IBAN]");
    expect(m).toContain("[PHONE]");
    expect(m).toContain("[ID]");
    expect(m).toContain("I nderuar [NAME]");
  });
  it("keeps URLs intact when asked", () => {
    expect(maskKeepingUrls("call 0691234567 or open https://x.example/a")).toBe("call [PHONE] or open https://x.example/a");
  });
  it("defangs and strips query strings", () => {
    expect(defang("https://bad.example/a")).toBe("hxxps://bad[.]example/a");
    expect(stripQuery("https://bad.example/a?email=x@y.z#f")).toBe("https://bad.example/a");
  });
});

describe("local rules", () => {
  it("flags urgency, link mismatch and risky attachments", () => {
    const r = analyzeLocal(email, (k) => k);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.reasons.map((x) => x.code)).toContain("link_mismatch");
    expect(mismatchedLinks([{ href: "https://www.e-albania.al/x", text: "e-albania.al" }])).toEqual([]);
  });
  it("maps scores to flags", () => {
    expect([0, 20, 40, 60, 80].map(flagFor)).toEqual(["green", "yellow", "orange", "red", "darkred"]);
  });
});

describe("what leaves the browser", () => {
  it("scan input: masked text and subject, URLs without query", () => {
    const input = toAnalysisInput(email, "sq");
    expect(input.urls).toEqual(["https://pogradec-fines-gov.al.example/pay"]);
    expect(input.subject).not.toContain("0691234567");
    expect(input.text).not.toMatch(/AL47|J12345678K|Arben/);
    expect(input.channel).toBe("email");
  });
  it("signal report: masked, defanged, sender domain only, excerpt ≤ 600", () => {
    const s = toSignals({ ...email, text: email.text.repeat(10) }, { score: 72.4, flag: "red", reasons: [{ code: "lookalike", text: "", weight: 25 }] }, "1.0.0");
    expect(s.senderDomain).toBe("pogradec-fines-gov.al.example");
    expect(JSON.stringify(s)).not.toMatch(/noreply@|ana@mail\.com|0691234567|Arben/);
    expect(s.urls).toEqual(["hxxps://pogradec-fines-gov[.]al[.]example/pay"]);
    expect(s.bodyExcerpt!.length).toBeLessThanOrEqual(600);
    expect(s.score).toBe(72);
  });
});

describe("decision", () => {
  it("submits at or above the threshold only with consent", () => {
    expect(decide(60, "red", 60, true)).toBe("submit");
    expect(decide(60, "red", 60, false)).toBe("needs_consent");
    expect(decide(59, "orange", 60, true)).toBe("below");
    expect(decide(90, "grey", 40, true)).toBe("below");
  });
  it("intel raises the score, never lowers it", () => {
    expect(combineScore({ score: 45, flag: "orange" }, 82)).toEqual({ score: 82, flag: "darkred" });
    expect(combineScore({ score: 45, flag: "orange" }, 30)).toEqual({ score: 45, flag: "orange" });
    expect(combineScore({ score: 10, flag: "grey" }, 90)).toEqual({ score: 10, flag: "grey" });
  });
});

describe("redirect unwrapping", () => {
  it("recovers Gmail and Outlook targets", () => {
    expect(unwrapRedirect("https://www.google.com/url?q=https://bad.example/x&sa=D")).toBe("https://bad.example/x");
    expect(unwrapRedirect("https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fbad.example%2F&data=1")).toBe("https://bad.example/");
    expect(unwrapRedirect("https://ok.example/")).toBe("https://ok.example/");
  });
});
