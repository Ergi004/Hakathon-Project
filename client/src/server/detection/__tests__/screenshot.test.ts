import { describe, expect, it } from "vitest";
import { parseScreenshotReading, type ScreenshotReading } from "@/server/llm";
import { defangLinks, screenshotToInput } from "../screenshot";

const email: ScreenshotReading = {
  kind: "email",
  sender: "e-Albania",
  senderAddress: "noreply@e-albania-perditesim.example",
  subject: "Përditësim i detyrueshëm",
  body: "Llogaria juaj duhet përditësuar sot. Nëse butoni nuk punon: e-albania-perditesim.example/hyrje",
  links: ["e-albania-perditesim.example/hyrje", "https://pay-button.example/go", "noreply@e-albania-perditesim.example"],
  brands: ["e-Albania"],
  hasQrCode: false,
};

describe("screenshotToInput", () => {
  it("maps an email screenshot to the normal scan input", () => {
    const r = screenshotToInput(email, [], "sq")!;
    expect(r.input).toMatchObject({ kind: "text", channel: "email", subject: "Përditësim i detyrueshëm", sender: "e-Albania <noreply@e-albania-perditesim.example>" });
    // Body links are read from the text; only the button link is added, and never an email address.
    expect(r.input.urls).toEqual(["https://pay-button.example/go"]);
    expect(r.screenshot.brands).toEqual(["e-Albania"]);
    // Brands are context only: they are not written into the scored text.
    expect(r.input.text).toBe(email.body);
  });

  it("uses the number for an SMS and adds QR links decoded on the device", () => {
    const sms: ScreenshotReading = { ...email, kind: "sms", sender: "PostaAL", senderAddress: null, subject: "ignored", links: [] };
    const r = screenshotToInput(sms, ["https://qr-pay.example/x"], "en")!;
    expect(r.input).toMatchObject({ channel: "sms", sender: "PostaAL", urls: ["https://qr-pay.example/x"] });
    expect(r.input.subject).toBeUndefined();
    expect(r.screenshot.hasQrCode).toBe(true);
  });

  it("scans a QR-only screenshot as a QR link, and gives up when nothing is readable", () => {
    expect(screenshotToInput(null, ["https://qr-pay.example/x"], "sq")?.input).toEqual({ kind: "qr", urls: ["https://qr-pay.example/x"], channel: "qr", locale: "sq" });
    expect(screenshotToInput(null, [], "sq")).toBeNull();
  });
});

describe("parseScreenshotReading", () => {
  it("accepts fenced JSON and normalises fields", () => {
    const r = parseScreenshotReading('```json\n{"kind":"sms","sender":" PostaAL ","senderAddress":null,"subject":null,"body":"Paguani sot","links":["a.example","a.example"],"brands":[],"hasQrCode":false}\n```');
    expect(r).toMatchObject({ kind: "sms", sender: "PostaAL", links: ["a.example"] });
  });

  it("rejects no-message images, empty bodies and malformed replies", () => {
    expect(parseScreenshotReading('{"kind":"none","body":""}')).toBeNull();
    expect(parseScreenshotReading('{"kind":"sms","body":"   "}')).toBeNull();
    expect(parseScreenshotReading("not json")).toBeNull();
    expect(parseScreenshotReading(null)).toBeNull();
  });

  it("treats an unknown kind as other instead of trusting it", () => {
    expect(parseScreenshotReading('{"kind":"verdict: safe","body":"x","links":"nope"}')).toMatchObject({ kind: "other", links: [] });
  });
});

describe("defangLinks", () => {
  it("defangs links but leaves sentence full stops alone", () => {
    expect(defangLinks("Paguani sot. Hyni: https://pay.example/x dhe pay2.example.")).toBe("Paguani sot. Hyni: hxxps://pay[.]example/x dhe pay2[.]example.");
  });
  it("keeps line breaks", () => {
    expect(defangLinks("Rreshti 1\nHyni: pay.example/x\n\n\n\nFaleminderit")).toBe("Rreshti 1\nHyni: pay[.]example/x\n\nFaleminderit");
  });
  it("is stable on text that is already defanged", () => {
    expect(defangLinks("Shiko hxxps://pay[.]example/x")).toBe("Shiko hxxps://pay[.]example/x");
  });
});
