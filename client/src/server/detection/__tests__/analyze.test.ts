import { describe, expect, it } from "vitest";
import { analyze } from "../index";
import { explain } from "../explain";
import { ctx, F019, IDS } from "./fixtures";

const FINE_SMS =
  "Bashkia Lezhë: Keni një gjobë parkimi të papaguar. Paguani sot brenda 24 orëve në 1ezhe-gov[.]al[.]example për të shmangur dyfishimin.";

const opts = { model: null };

describe("analyze: SPEC 6.3 worked examples", () => {
  it("1ezhe-gov homoglyph, young domain, SMS claiming a fine → red (61-70)", async () => {
    const r = await analyze({ kind: "text", channel: "sms", locale: "sq", sender: "+355 69 000 0000", text: FINE_SMS }, ctx(), opts);
    expect(r.flag).toBe("red");
    expect(r.score).toBeGreaterThanOrEqual(61);
    expect(r.score).toBeLessThanOrEqual(70);
    expect(r.groups.links).toBe(30);
    expect(r.groups.sender).toBe(12);
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(["lookalike_homoglyph", "domain_new", "unknown_sms_sender", "threat"]));
    expect(r.matchedInstitution).toEqual({ id: IDS.lezhe, name: "Bashkia Lezhë" });
    expect(r.iocs).toContainEqual({ type: "domain", value: "1ezhe-gov[.]al[.]example" });
  });

  it("…becomes dark red once the domain is blocklisted", async () => {
    const r = await analyze(
      { kind: "text", channel: "sms", locale: "sq", sender: "+355 69 000 0000", text: FINE_SMS },
      ctx({ blocklist: [{ kind: "domain", value: "1ezhe-gov.al.example" }] }),
      opts,
    );
    expect(r.flag).toBe("darkred");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.reasons.map((x) => x.code)).toContain("known_bad");
  });

  it("F019 domains resolve to the same campaign with matchType known", async () => {
    const a = await analyze({ kind: "url", channel: "web", locale: "sq", urls: ["hxxps://pogradec-fines-gov[.]al[.]example/pagesa"] }, ctx(), opts);
    const b = await analyze({ kind: "url", channel: "web", locale: "sq", urls: ["xn--pogradc-dhg.al.test"] }, ctx(), opts);
    for (const r of [a, b]) {
      expect(r.campaign).toEqual({ id: F019.id, code: "F019", matchType: "known", confidence: 1 });
      expect(r.score).toBeGreaterThanOrEqual(80); // confirmed campaign IoC → floor
      expect(r.matchedInstitution?.id).toBe(IDS.pogradec);
    }
  });

  it("official SMS sender with fine/payment words scores ≤ 19", async () => {
    const r = await analyze(
      {
        kind: "text",
        channel: "sms",
        locale: "sq",
        sender: "BashkiaLezhe",
        text: "Bashkia Lezhë: Kujtojmë se afati për pagesën e gjobës së parkimit është 30 nëntor. Paguani në sportel ose në lezhe.gov.al.example.",
      },
      ctx(),
      opts,
    );
    expect(r.score).toBeLessThanOrEqual(19);
    expect(r.flag).toBe("green");
    expect(r.reasons.map((x) => x.code)).toContain("official_sender");
  });

  it("official email sender with passing auth scores ≤ 19", async () => {
    const r = await analyze(
      {
        kind: "email_signals",
        channel: "email",
        locale: "en",
        sender: "Banka Shembull <njoftime@bankashembull.al.example>",
        subject: "Payment reminder",
        text: "Your card payment of the annual fee is due today. Log in at bankashembull.al.example.",
        headers: { spf: "pass", dkim: "pass", dmarc: "pass" },
      },
      ctx(),
      opts,
    );
    expect(r.score).toBeLessThanOrEqual(19);
  });
});

describe("analyze: other signals", () => {
  it("scores a spoofed email with failing auth, reply-to mismatch and a macro attachment", async () => {
    const r = await analyze(
      {
        kind: "email_signals",
        channel: "email",
        locale: "en",
        sender: '"e-Albania" <noreply@gmail.com>',
        subject: "Urgent: verify your account",
        text: "Your e-Albania account will be suspended today. Verify your identity at e-albnia.al.example and enter the OTP code.",
        urls: ["https://e-albnia.al.example/login"],
        headers: { spf: "fail", dkim: "fail", dmarc: "fail", replyTo: "help@mail.test" },
        attachments: [{ name: "fatura.pdf.exe", mime: "application/x-msdownload", size: 2048 }],
      },
      ctx(),
      opts,
    );
    expect(r.groups.sender).toBe(25);
    expect(r.groups.attachments).toBe(10);
    expect(["red", "darkred"]).toContain(r.flag);
    expect(r.iocs).toContainEqual({ type: "email", value: "noreply@gmail[.]com" });
  });

  it("returns grey when nothing could be analysed", async () => {
    const r = await analyze({ kind: "text", channel: "other", locale: "sq", text: "   " }, ctx(), opts);
    expect(r.flag).toBe("grey");
    expect(r.reasons[0].code).toBe("not_analysed");
  });

  it("treats an official phone number as safe", async () => {
    const r = await analyze({ kind: "phone", channel: "call", locale: "sq", text: "042 222 222" }, ctx(), opts);
    expect(r.score).toBeLessThanOrEqual(19);
    expect(r.matchedInstitution?.id).toBe(IDS.ealbania);
  });

  it("reasons are bilingual and evidence is defanged", async () => {
    const r = await analyze({ kind: "url", channel: "web", locale: "en", urls: ["https://1ezhe-gov.al.example"] }, ctx(), opts);
    for (const reason of r.reasons) {
      expect(reason.text_sq.length).toBeGreaterThan(10);
      expect(reason.text_en.length).toBeGreaterThan(10);
      expect(reason.text_en).not.toMatch(/1ezhe-gov\.al/);
    }
  });

  it("runs in under 300 ms", async () => {
    const c = ctx();
    const t = performance.now();
    for (let i = 0; i < 20; i++) {
      await analyze({ kind: "text", channel: "sms", locale: "sq", sender: "+355690000000", text: FINE_SMS.repeat(5) }, c, opts);
    }
    expect((performance.now() - t) / 20).toBeLessThan(300);
  });
});

describe("explain", () => {
  it("falls back to template text without an LLM and never sends raw text", async () => {
    const r = await analyze({ kind: "text", channel: "sms", locale: "sq", sender: "+355690000000", text: FINE_SMS }, ctx(), opts);
    expect((await explain(r, "en")).source).toBe("template");

    let sent = "";
    const out = await explain(r, "sq", {
      generate: async ({ data }) => {
        sent = data;
        return "Dy fjali.";
      },
    });
    expect(out).toEqual({ text: "Dy fjali.", source: "llm" });
    expect(sent).not.toContain("Paguani");
    expect(sent).not.toContain("1ezhe-gov.al");
    expect(r.score).toBe((await analyze({ kind: "text", channel: "sms", locale: "sq", sender: "+355690000000", text: FINE_SMS }, ctx(), opts)).score);
  });

  it("falls back when the LLM fails", async () => {
    const r = await analyze({ kind: "url", channel: "web", locale: "en", urls: ["https://1ezhe-gov.al.example"] }, ctx(), opts);
    expect((await explain(r, "en", { generate: async () => null })).source).toBe("template");
  });
});
