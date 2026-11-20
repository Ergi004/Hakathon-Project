import { describe, expect, it } from "vitest";
import { defang, extractUrls, foldText, hostOf, normalizePhone, normalizeText, parseSender, refang } from "../normalize";

describe("normalize", () => {
  it("strips zero-width characters and applies NFKC", () => {
    expect(normalizeText("pa​guaj﻿  ｓｏｔ")).toBe("paguaj sot");
  });

  it("folds Albanian diacritics", () => {
    expect(foldText("Gjobë Çmimi")).toBe("gjobe cmimi");
  });

  it("refangs and defangs", () => {
    expect(refang("hxxps://1ezhe-gov[.]al[.]example/pay")).toBe("https://1ezhe-gov.al.example/pay");
    expect(defang("https://1ezhe-gov.al.example/pay")).toBe("hxxps://1ezhe-gov[.]al[.]example/pay");
    expect(defang("pogradec-fines-gov.al.example")).toBe("pogradec-fines-gov[.]al[.]example");
  });

  it("extracts defanged and bare URLs from text", () => {
    const urls = extractUrls("Paguani te 1ezhe-gov[.]al[.]example ose https://bit.ly/x sot. Faleminderit.");
    expect(urls).toContain("1ezhe-gov.al.example");
    expect(urls).toContain("https://bit.ly/x");
    expect(urls).toHaveLength(2);
  });

  it("does not turn email addresses into link indicators (regression: ana.hoxha@gmail.com → ana.hoxha)", () => {
    expect(extractUrls("Shkruani te ana.hoxha@gmail.com ose ana[at]posta.al.example sot")).toEqual([]);
    expect(extractUrls("Kontakt: info@banka.al.example, faqja www.banka.al.example")).toEqual(["www.banka.al.example"]);
  });

  it("returns hosts in punycode and lower case", () => {
    expect(hostOf("HTTP://WWW.Pogradеc.al.test/a")).toBe("xn--pogradc-dhg.al.test");
  });

  it("normalises Albanian phone numbers", () => {
    expect(normalizePhone("069 123 4567")).toBe("+355691234567");
    expect(normalizePhone("00355 69 123 4567")).toBe("+355691234567");
  });

  it("parses display name senders", () => {
    expect(parseSender('"e-Albania" <info@gmail.com>')).toEqual({ display: "e-Albania", address: "info@gmail.com", domain: "gmail.com" });
  });
});
