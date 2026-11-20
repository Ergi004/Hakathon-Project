import { describe, expect, it } from "vitest";
import type { DetectionContext } from "../context";
import { parseHost, scoreDomain } from "../domain-score";
import { extractUrls, hostOf } from "../normalize";
import {
  classifyScam,
  extractFeatures,
  groupCandidates,
  SIGNAL_WEIGHTS,
  type CampaignGroup,
  type PatternSignals,
  type ScamFeatures,
  type SignalCode,
} from "../pattern";
import { scoreRules } from "../rules";
import type { AnalysisInput } from "../types";
import { scoreWhois } from "../whois-score";
import { ctx } from "./fixtures";

const FINE_SMS =
  "Bashkia Lezhë: Keni një gjobë parkimi të papaguar. Paguani sot brenda 24 orëve në 1ezhe-gov[.]al[.]example për të shmangur dyfishimin.";

const POSTAL_SMS =
  "Pakoja juaj nr. 4471 është ndalur në magazinë. Paguani 1.50 euro tarifë dërgese te hxxps://postashqiptare-dergesa[.]example/pagesa që ta merrni nesër.";

const c = ctx();

function signalsFor(input: AnalysisInput, context: DetectionContext = c): PatternSignals {
  const text = [input.subject, input.text].filter(Boolean).join("\n");
  const urls = [...(input.urls ?? []), ...(input.kind === "phone" ? [] : extractUrls(text))];
  const hosts = [...new Set(urls.map((url) => hostOf(url)).filter((host): host is string => host !== null))];
  return {
    hosts: hosts.map((host) => ({
      domain: scoreDomain(host, context),
      whois: scoreWhois(host, context),
      intel: context.domainIntel.get(host) ?? context.domainIntel.get(parseHost(host).registrable) ?? null,
    })),
    rules: scoreRules(input.kind === "phone" ? "" : text),
  };
}

function confidenceOf(codes: SignalCode[]): number {
  const sum = codes.reduce((total, code) => total + SIGNAL_WEIGHTS[code], 0);
  return Math.round(Math.min(1, sum) * 100) / 100;
}

function emptyFeatures(over: Partial<ScamFeatures> = {}): ScamFeatures {
  return {
    domain: {
      host: null,
      tld: null,
      lookalikeTarget: null,
      lookalikeClass: null,
      official: false,
      ageUnder30Days: null,
      oddTld: false,
      punycode: false,
      shortener: false,
      ...over.domain,
    },
    content: { urgency: null, payment: null, threat: null, secrets: null, ...over.content },
    infrastructure: { registrar: null, nameserver: null, hostingCountry: null, ...over.infrastructure },
    exfil: over.exfil ?? [],
    brands: over.brands ?? [],
    themes: over.themes ?? [],
  };
}

describe("extractFeatures", () => {
  it("reads a lookalike fine SMS from signals already scored", () => {
    const input: AnalysisInput = { kind: "text", channel: "sms", locale: "sq", text: FINE_SMS };
    const features = extractFeatures(input, signalsFor(input));

    expect(features.domain.host).toBe("1ezhe-gov.al.example");
    expect(features.domain.tld).toBe("al");
    expect(features.domain.lookalikeClass).toBe("homoglyph");
    expect(features.domain.lookalikeTarget).toBe("lezhe.gov.al.example");
    expect(features.domain.official).toBe(false);
    expect(features.domain.ageUnder30Days).toBe(true);
    expect(features.content.urgency).toBeTruthy();
    expect(features.content.payment).toBeTruthy();
    expect(features.content.threat).toBeTruthy();
    expect(features.content.secrets).toBeNull();
    expect(features.infrastructure).toEqual({
      registrar: "Regjistrues Shembull",
      nameserver: null,
      hostingCountry: "XX",
    });
    expect(features.exfil).toEqual([]);
    expect(features.brands).toContainEqual({
      category: "municipality",
      evidence: "lezhe.gov.al.example",
      source: "lookalike",
    });
    expect(features.themes).toEqual([]);
  });

  it("reads a postal-fee link and keeps missing intel null", () => {
    const input: AnalysisInput = { kind: "text", channel: "sms", locale: "sq", text: POSTAL_SMS };
    const features = extractFeatures(input, signalsFor(input));

    expect(features.domain.lookalikeClass).toBe("combosquat");
    expect(features.domain.lookalikeTarget).toBe("postashqiptare.al.example");
    expect(features.domain.ageUnder30Days).toBeNull();
    expect(features.infrastructure).toEqual({ registrar: null, nameserver: null, hostingCountry: null });
    expect(features.content.payment).toBeTruthy();
    expect(features.content.threat).toBeNull();
    expect(features.exfil).toEqual([]);
    expect(features.brands).toContainEqual({
      category: "postal",
      evidence: "postashqiptare.al.example",
      source: "lookalike",
    });
    expect(features.themes).toContainEqual({ code: "parcel", evidence: "pakoja" });
  });

  it("yields empty scam features for an official domain", () => {
    const input: AnalysisInput = {
      kind: "url",
      channel: "web",
      locale: "sq",
      urls: ["https://e-albania.al.example"],
      text: "",
    };
    const features = extractFeatures(input, signalsFor(input));

    expect(features.domain.host).toBe("e-albania.al.example");
    expect(features.domain.official).toBe(true);
    expect(features.domain.lookalikeTarget).toBeNull();
    expect(features.domain.lookalikeClass).toBeNull();
    expect(features.domain.ageUnder30Days).toBeNull();
    expect(features.domain.oddTld).toBe(false);
    expect(features.content).toEqual({ urgency: null, payment: null, threat: null, secrets: null });
    expect(features.infrastructure).toEqual({ registrar: null, nameserver: null, hostingCountry: null });
    expect(features.exfil).toEqual([]);
    expect(features.brands).toEqual([]);
    expect(features.themes).toEqual([]);
  });

  it("collects telegram, webhook, and php endpoints already present in the text", () => {
    const input: AnalysisInput = {
      kind: "text",
      channel: "sms",
      locale: "sq",
      text: "Konfirmo te https://t.me/mburoja_lure dhe https://webhook.site/abc-123 ose https://pay.example/gate.php?x=1 por jo https://e-albania.al.example/help",
    };
    const features = extractFeatures(input, signalsFor(input));

    expect(features.exfil).toEqual([
      { kind: "telegram", url: "https://t.me/mburoja_lure", endpoint: "t.me/mburoja_lure" },
      { kind: "webhook", url: "https://webhook.site/abc-123", endpoint: "webhook.site/abc-123" },
      { kind: "php", url: "https://pay.example/gate.php?x=1", endpoint: "pay.example/gate.php" },
    ]);
  });
});

describe("classifyScam", () => {
  it("classifies the lookalike fine SMS as a municipal fine", () => {
    const input: AnalysisInput = { kind: "text", channel: "sms", locale: "sq", text: FINE_SMS };
    const result = classifyScam(extractFeatures(input, signalsFor(input)));
    const codes: SignalCode[] = ["lookalike", "young_domain", "urgency", "payment", "threat", "brand_mention"];

    expect(result.scamType).toBe("fine_or_tax_refund");
    expect(result.impersonatedBrand).toBe("municipality");
    expect(result.matchedSignals.map((signal) => signal.code)).toEqual(codes);
    expect(result.confidence).toBe(confidenceOf(codes));
    expect(result.matchedSignals.map((signal) => signal.weight)).toEqual(codes.map((code) => SIGNAL_WEIGHTS[code]));
    expect(result.matchedSignals.find((signal) => signal.code === "threat")?.evidence).toBe(scoreRules(FINE_SMS).threat);
    expect(result.matchedSignals.find((signal) => signal.code === "brand_mention")?.evidence).toBe(
      "municipality:lezhe.gov.al.example",
    );
  });

  it("classifies the postal-fee link as a parcel fee", () => {
    const input: AnalysisInput = { kind: "text", channel: "sms", locale: "sq", text: POSTAL_SMS };
    const result = classifyScam(extractFeatures(input, signalsFor(input)));
    const codes: SignalCode[] = ["lookalike", "urgency", "payment", "theme_parcel", "brand_mention"];

    expect(result.scamType).toBe("parcel_postal_fee");
    expect(result.impersonatedBrand).toBe("postal");
    expect(result.matchedSignals.map((signal) => signal.code)).toEqual(codes);
    expect(result.confidence).toBe(confidenceOf(codes));
  });

  it("does not classify an official domain", () => {
    const input: AnalysisInput = {
      kind: "url",
      channel: "web",
      locale: "sq",
      urls: ["https://e-albania.al.example"],
      text: "",
    };
    expect(classifyScam(extractFeatures(input, signalsFor(input)))).toEqual({
      scamType: "other",
      impersonatedBrand: "other",
      confidence: 0,
      matchedSignals: [],
    });
  });

  it("classifies a bank credential lure", () => {
    const result = classifyScam(
      emptyFeatures({
        content: { urgency: null, payment: null, threat: null, secrets: "password" },
        brands: [{ category: "bank", evidence: "bankashembull.al.example", source: "lookalike" }],
        themes: [{ code: "login", evidence: "password" }],
        domain: {
          host: "bankashembull-login.example",
          tld: "example",
          lookalikeTarget: "bankashembull.al.example",
          lookalikeClass: "combosquat",
          official: false,
          ageUnder30Days: null,
          oddTld: false,
          punycode: false,
          shortener: false,
        },
      }),
    );
    expect(result.scamType).toBe("fake_bank");
    expect(result.impersonatedBrand).toBe("bank");
    expect(result.matchedSignals.map((signal) => signal.code)).toContain("secrets");
  });

  it("classifies an e-Albania login lure", () => {
    const result = classifyScam(
      emptyFeatures({
        content: { urgency: null, payment: null, threat: null, secrets: "otp" },
        brands: [{ category: "e_albania", evidence: "e-albania", source: "text" }],
        themes: [{ code: "login", evidence: "verifiko" }],
      }),
    );
    expect(result.scamType).toBe("fake_institution_login");
    expect(result.impersonatedBrand).toBe("e_albania");
  });

  it("classifies an app-install lure", () => {
    const result = classifyScam(
      emptyFeatures({
        content: { urgency: null, payment: null, threat: null, secrets: "otp" },
        themes: [{ code: "app", evidence: "aplikacionin" }],
        brands: [{ category: "telecom", evidence: "vodafone", source: "text" }],
      }),
    );
    expect(result.scamType).toBe("fake_app");
    expect(result.impersonatedBrand).toBe("telecom");
  });
});

describe("groupCandidates", () => {
  const fineBody = (host: string) =>
    `Bashkia Lezhë: Keni një gjobë parkimi të papaguar. Paguani sot brenda 24 orëve në https://${host}/pay për të shmangur dyfishimin.`;

  it("groups on a shared exfil endpoint before the domain", () => {
    const group = groupCandidates(
      {
        hosts: ["a.example"],
        urls: ["https://a.example/login", "https://t.me/scamchannel"],
        exfilEndpoints: [],
        text: "alfa beta gamma delta epsilon",
      },
      {
        hosts: ["b.example"],
        urls: ["https://b.example/login", "https://t.me/scamchannel"],
        exfilEndpoints: ["t.me/scamchannel"],
        text: "omega sigma theta lambda kappa",
      },
    );
    expect(group).toEqual({ groupKey: "exfil:t.me/scamchannel", reason: "shared_exfil", evidence: "t.me/scamchannel" });
  });

  it("groups on a shared URL path", () => {
    const group = groupCandidates(
      { hosts: [], urls: ["https://Pay.Example/invoice/9?x=1"], exfilEndpoints: [] },
      { hosts: [], urls: ["http://pay.example/invoice/9"], exfilEndpoints: [] },
    );
    expect(group).toEqual({
      groupKey: "url:pay.example/invoice/9",
      reason: "shared_url",
      evidence: "pay.example/invoice/9",
    });
  });

  it("groups on a shared domain when the paths differ", () => {
    const group = groupCandidates(
      { hosts: ["1ezhe-gov.al.example"], urls: ["https://1ezhe-gov.al.example/a"], exfilEndpoints: [], text: "alfa beta gamma delta" },
      { hosts: ["https://1ezhe-gov.al.example/b"], urls: ["https://1ezhe-gov.al.example/b"], exfilEndpoints: [], text: "omega sigma theta lambda" },
    );
    expect(group).toEqual({
      groupKey: "domain:1ezhe-gov.al.example",
      reason: "shared_domain",
      evidence: "1ezhe-gov.al.example",
    });
  });

  it("groups similar texts by shingle TF-IDF when nothing structural is shared", () => {
    const left = groupCandidates(
      { hosts: ["fine-a.example"], urls: ["https://fine-a.example/pay"], exfilEndpoints: [], text: fineBody("fine-a.example") },
      { hosts: ["fine-b.example"], urls: ["https://fine-b.example/pay"], exfilEndpoints: [], text: fineBody("fine-b.example") },
    );
    const right = groupCandidates(
      { hosts: ["fine-b.example"], urls: ["https://fine-b.example/pay"], exfilEndpoints: [], text: fineBody("fine-b.example") },
      { hosts: ["fine-a.example"], urls: ["https://fine-a.example/pay"], exfilEndpoints: [], text: fineBody("fine-a.example") },
    );
    expect(left?.reason).toBe("similar_text");
    expect(left?.evidence).toBe("1.00");
    expect(left?.groupKey.startsWith("text:")).toBe(true);
    expect(right?.groupKey).toBe(left?.groupKey);
  });

  it("does not group unrelated text", () => {
    const group: CampaignGroup | null = groupCandidates(
      { hosts: ["fine-a.example"], urls: ["https://fine-a.example/pay"], exfilEndpoints: [], text: fineBody("fine-a.example") },
      {
        hosts: ["weather.example"],
        urls: ["https://weather.example/today"],
        exfilEndpoints: [],
        text: "Moti nesër është me diell në Tiranë dhe deti është i qetë gjatë fundjavës.",
      },
    );
    expect(group).toBeNull();
  });
});
