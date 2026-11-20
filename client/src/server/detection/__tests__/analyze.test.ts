import { describe, expect, it } from "vitest";
import { analyze } from "../index";
import { explain } from "../explain";
import type { TextModel } from "../text-model";
import { baseData, ctx, F019, IDS } from "./fixtures";

const BLIND_MODEL: TextModel = { name: "blind", version: "0", kind: "tfidf-lr", vocab: {}, weights: [], bias: -8 };

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
    expect(r.reasons.map((x) => x.code)).not.toContain("whois_privacy");
    expect(r.reasons.find((x) => x.code === "domain_new")?.weight).toBe(23);
    expect(r.matchedInstitution).toEqual({ id: IDS.lezhe, name: "Bashkia Lezhë" });
    expect(r.iocs).toContainEqual({ type: "domain", value: "1ezhe-gov[.]al[.]example" });
    expect(r.classification.scamType).toBe("fine_or_tax_refund");
    expect(r.classification.impersonatedBrand).toBe("municipality");
    expect(r.classification.matchedSignals.map((signal) => signal.code)).toEqual(
      expect.arrayContaining(["lookalike", "young_domain", "threat", "brand_mention"]),
    );
    expect(r.features.domain.host).toBe("1ezhe-gov.al.example");
    expect(r.features.infrastructure.hostingCountry).toBe("XX");
    expect(r.features.claimedPlace).toBe("Bashkia Lezhë");
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

  it("recognises a postal domain built from the institution name plus a fee word", async () => {
    const r = await analyze(
      {
        kind: "text",
        channel: "sms",
        locale: "sq",
        text: "Pakoja juaj nr. 4471 është ndalur në magazinë. Paguani 1.50 euro tarifë dërgese te hxxps://posta-pagese[.]example/pagesa që ta merrni nesër.",
      },
      ctx(),
      opts,
    );
    expect(r.classification.scamType).toBe("parcel_postal_fee");
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.flag).toBe("orange");
    expect(r.reasons.map((item) => item.code)).toContain("lookalike_combosquat");
    expect(r.reasons.map((item) => item.code)).toContain("lure_destination");
    expect(r.matchedInstitution).toEqual({ id: IDS.posta, name: "Posta Shqiptare" });
    expect(r.reasons.map((item) => item.code)).not.toContain("impersonated_link");
  });

  it("still counts Albanian cue words when the trained model is unsure", async () => {
    const text = "Pakoja juaj nr. 4471 është ndalur në magazinë. Paguani 1.50 euro tarifë dërgese te hxxps://posta-pagese[.]example/pagesa që ta merrni nesër.";
    const input = { kind: "text" as const, channel: "sms" as const, locale: "sq" as const, text };
    const blind = await analyze(input, ctx(), { model: BLIND_MODEL });
    const lexicon = await analyze(input, ctx(), opts);
    expect(blind.reasons.map((item) => item.code)).toContain("classifier");
    expect(blind.score).toBe(lexicon.score);
  });

  it("recognises a named institution whose link is not its domain", async () => {
    const r = await analyze(
      {
        kind: "text",
        channel: "sms",
        locale: "sq",
        text: "Posta Shqiptare: pakoja juaj nuk u dorëzua. Paguani tarifën 2 euro këtu: https://pagesa-fee.example/fee",
      },
      ctx(),
      opts,
    );
    expect(r.classification.scamType).toBe("parcel_postal_fee");
    expect(r.score).toBeGreaterThanOrEqual(65);
    expect(r.score).toBeLessThanOrEqual(70);
    expect(r.flag).toBe("red");
    expect(r.reasons.map((item) => item.code)).toContain("unofficial_claim");
    expect(r.reasons.find((item) => item.code === "impersonated_link")?.weight).toBe(18);
    expect(r.reasons.map((item) => item.code)).toContain("impersonated_link");
    expect(r.reasons.find((item) => item.code === "impersonated_link")?.evidence).toContain("Posta Shqiptare");
    expect(r.matchedInstitution?.id).toBe(IDS.posta);
  });

  it("recognises a bank login domain and an account-verification demand", async () => {
    const bank = await analyze(
      {
        kind: "text",
        channel: "sms",
        locale: "sq",
        text: "Banka juaj: llogaria është bllokuar. Hyni në llogari dhe verifikoni të dhënat te https://banka-login.example/hyr",
      },
      ctx(),
      opts,
    );
    expect(bank.reasons.map((item) => item.code)).toEqual(expect.arrayContaining(["lookalike_combosquat", "asks_secrets", "threat"]));
    expect(bank.matchedInstitution?.id).toBe(IDS.banka);
    expect(bank.classification.scamType).toBe("fake_bank");

    const login = await analyze(
      {
        kind: "text",
        channel: "sms",
        locale: "sq",
        text: "e-Albania: hyni në llogari dhe verifikoni të dhënat te https://e-albania-login.example/verify",
      },
      ctx(),
      opts,
    );
    expect(login.reasons.map((item) => item.code)).toEqual(expect.arrayContaining(["lookalike_combosquat", "asks_secrets"]));
    expect(login.classification.scamType).toBe("fake_institution_login");
    expect(login.matchedInstitution?.id).toBe(IDS.ealbania);
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

describe("analyze: Gemini signal", () => {
  const quiet = "Your parcel is waiting at the depot. Settle the release charge here: https://depot-release.example/collect";

  it("adds only the clues Gemini actually reports, and cannot reach a verdict alone", async () => {
    const without = await analyze({ kind: "text", channel: "sms", locale: "en", text: quiet }, ctx(), opts);
    const withModel = await analyze({ kind: "text", channel: "sms", locale: "en", text: quiet }, ctx(), {
      ...opts,
      gemini: async () => ({
        scam: true,
        confidence: 0.9,
        scamType: "parcel_postal_fee",
        brand: "postal",
        clues: ["payment", "impersonation"],
      }),
    });
    expect(without.classification.scamType).toBe("other");
    expect(withModel.classification.scamType).toBe("parcel_postal_fee");
    expect(withModel.classification.impersonatedBrand).toBe("postal");
    expect(withModel.reasons.map((item) => item.code)).toEqual(
      expect.arrayContaining(["gemini_review", "payment_lure", "impersonated_link", "lure_destination"]),
    );
    expect(withModel.score).toBeGreaterThan(without.score);
    expect(withModel.score).toBeGreaterThanOrEqual(40);
    expect(withModel.modelVersion).toContain("+gemini");

    const opinionOnly = await analyze({ kind: "text", channel: "sms", locale: "en", text: quiet }, ctx(), {
      ...opts,
      gemini: async () => ({ scam: true, confidence: 0.9, scamType: "other", brand: "other", clues: [] }),
    });
    expect(opinionOnly.score).toBeLessThan(40);
  });

  it("does not clear a real finding when Gemini says the message is safe", async () => {
    const gemini = async () => ({ scam: false, confidence: 0.1, scamType: "other" as const, brand: "other" as const, clues: [] });
    const plain = await analyze({ kind: "text", channel: "sms", locale: "sq", sender: "+355 69 000 0000", text: FINE_SMS }, ctx(), opts);
    const reviewed = await analyze({ kind: "text", channel: "sms", locale: "sq", sender: "+355 69 000 0000", text: FINE_SMS }, ctx(), { ...opts, gemini });
    expect(reviewed.score).toBe(plain.score);
    expect(reviewed.flag).toBe("red");
  });

  it("keeps an official sender at 19 or below even when Gemini is sure", async () => {
    const r = await analyze(
      {
        kind: "text",
        channel: "sms",
        locale: "sq",
        sender: "BashkiaLezhe",
        text: "Bashkia Lezhë: Kujtojmë se afati për pagesën e gjobës së parkimit është 30 nëntor. Paguani në sportel ose në lezhe.gov.al.example.",
      },
      ctx(),
      {
        ...opts,
        gemini: async () => ({ scam: true, confidence: 1, scamType: "fine_or_tax_refund", brand: "municipality", clues: ["payment", "threat"] }),
      },
    );
    expect(r.score).toBeLessThanOrEqual(19);
    expect(r.flag).toBe("green");
  });
});

describe("analyze: tuned signal rules", () => {
  it("does not treat a code the message gives you as a request for a secret", async () => {
    const given = await analyze({ kind: "text", channel: "sms", locale: "en", sender: "Bank", text: "Your code is 482913" }, ctx(), opts);
    expect(given.reasons.map((item) => item.code)).not.toContain("asks_secrets");

    const asked = await analyze(
      { kind: "text", channel: "sms", locale: "en", text: "Send us your PIN to unlock the account: https://pin-ask.example/a" },
      ctx(),
      opts,
    );
    expect(asked.reasons.find((item) => item.code === "asks_secrets")?.weight).toBe(18);
  });

  it("counts punycode only when the domain also imitates a brand", async () => {
    const alone = await analyze({ kind: "url", channel: "web", locale: "en", urls: ["https://xn--bcher-kva.example/x"] }, ctx(), opts);
    expect(alone.reasons.map((item) => item.code)).not.toContain("punycode");
  });

  it("grades domain age and raises it beside an institution claim", async () => {
    const young = ctx({
      domainIntel: [
        ...(baseData.domainIntel ?? []),
        { domain: "fresh.example", ageDays: 4 },
        { domain: "month.example", ageDays: 20 },
      ],
    });
    const week = await analyze({ kind: "url", channel: "web", locale: "en", urls: ["https://fresh.example/a"] }, young, opts);
    const older = await analyze({ kind: "url", channel: "web", locale: "en", urls: ["https://month.example/a"] }, young, opts);
    const claimed = await analyze(
      { kind: "text", channel: "sms", locale: "sq", text: "Bashkia Lezhë: paguani te https://month.example/a" },
      young,
      opts,
    );
    expect(week.reasons.find((item) => item.code === "domain_new")?.weight).toBe(15);
    expect(older.reasons.find((item) => item.code === "domain_new")?.weight).toBe(10);
    expect(claimed.reasons.find((item) => item.code === "domain_new")?.weight).toBe(15);
  });

  it("flags an unknown SMS sender only when there is a link or an institution", async () => {
    const hello = await analyze(
      { kind: "text", channel: "sms", locale: "sq", sender: "+355691111111", text: "Pershendetje, si je?" },
      ctx(),
      opts,
    );
    const linked = await analyze(
      { kind: "text", channel: "sms", locale: "sq", sender: "+355691111111", text: "Shiko https://shop-note.example/x" },
      ctx(),
      opts,
    );
    expect(hello.reasons.map((item) => item.code)).not.toContain("unknown_sms_sender");
    expect(linked.reasons.map((item) => item.code)).toContain("unknown_sms_sender");
  });

  it("scores a visible link that disagrees with the destination only for email", async () => {
    const shared = {
      locale: "en" as const,
      text: "Open https://lezhe.gov.al.example today",
      urls: ["https://not-lezhe.example/pay"],
      sender: "a@mail.test",
    };
    const email = await analyze({ ...shared, kind: "email_signals", channel: "email" }, ctx(), opts);
    const sms = await analyze({ ...shared, kind: "text", channel: "sms" }, ctx(), opts);
    expect(email.reasons.find((item) => item.code === "link_mismatch")?.weight).toBe(15);
    expect(sms.reasons.map((item) => item.code)).not.toContain("link_mismatch");
  });

  it("weights a failed check higher when the From domain publishes reject", async () => {
    const strict = await analyze(
      {
        kind: "email_signals",
        channel: "email",
        locale: "en",
        sender: "njoftime@lezhe.gov.al.example",
        text: "A notice",
        headers: { spf: "fail", dmarcPolicy: "reject" },
      },
      ctx(),
      opts,
    );
    const loose = await analyze(
      {
        kind: "email_signals",
        channel: "email",
        locale: "en",
        sender: "someone@mail.test",
        text: "A notice",
        headers: { spf: "fail" },
      },
      ctx(),
      opts,
    );
    expect(strict.reasons.find((item) => item.code === "auth_fail")?.weight).toBe(15);
    expect(loose.reasons.find((item) => item.code === "auth_fail")?.weight).toBe(10);
  });

  it("caps many reports at one signal no matter how large the distinct count is", async () => {
    const crowded = await analyze(
      { kind: "url", channel: "web", locale: "en", urls: ["https://crowd.example/a"] },
      ctx({ recentReporters: [{ kind: "domain", value: "crowd.example", count: 40 }] }),
      opts,
    );
    const quiet = await analyze(
      { kind: "url", channel: "web", locale: "en", urls: ["https://crowd.example/a"] },
      ctx({ recentReporters: [{ kind: "domain", value: "crowd.example", count: 2 }] }),
      opts,
    );
    expect(crowded.reasons.find((item) => item.code === "many_reports")?.weight).toBe(6);
    expect(quiet.reasons.map((item) => item.code)).not.toContain("many_reports");
  });
});
