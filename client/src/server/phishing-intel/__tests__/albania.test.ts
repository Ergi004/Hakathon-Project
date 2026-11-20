import { describe, expect, it } from "vitest";
import { albaniaSignals, looksAlbanian } from "../albania";
import { parseSms } from "../channels/sms/sms-analyzer";
import { extractIocs } from "../intelligence/ioc-extractor";

const signals = (text: string, sender?: string, inst = false) => {
  const msg = parseSms({ text, sender }, "manual_input", "sq");
  return albaniaSignals(msg, extractIocs(msg), inst);
};

describe("Albania scope for the SOC filter", () => {
  it("detects Albanian text, with or without diacritics", () => {
    expect(looksAlbanian("Paketa juaj është bllokuar. Paguani tarifën sot.")).toBe(true);
    expect(looksAlbanian("Paketa juaj eshte bllokuar, paguani sot ne linkun per te")).toBe(true);
    expect(looksAlbanian("Your parcel is on hold. Pay the fee today.")).toBe(false);
  });

  it("collects concrete signals", () => {
    expect(signals("Pay now at hxxps://posta-al[.]test", "+355 69 123 4567")).toEqual(["al_sender"]);
    expect(signals("Pay at https://e-albania.al.example/pay")).toEqual(["al_domain"]);
    expect(signals("Call 069 123 4567 about your refund")).toEqual(["al_phone"]);
    expect(signals("Your account is locked", undefined, true)).toEqual(["al_institution"]);
  });

  it("a foreign English scam with no Albanian link is out of scope", () => {
    expect(signals("Your parcel is on hold. Pay at https://parcel-fee.example.com", "+44 7700 900123")).toEqual([]);
  });
});
