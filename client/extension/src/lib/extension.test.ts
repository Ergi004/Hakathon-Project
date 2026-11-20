import { describe, expect, it } from "vitest";
import { unwrapLink } from "../content/adapters";
import { toRequest } from "./api";
import { flagFor } from "./config";

describe("extension helpers", () => {
  it("unwraps Gmail and Outlook safelinks to the real destination", () => {
    expect(unwrapLink("https://www.google.com/url?q=https://evil.test/login&sa=D")).toBe("https://evil.test/login");
    expect(unwrapLink("https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fevil.test%2Fx&data=1")).toBe("https://evil.test/x");
    expect(unwrapLink("https://bank.example/")).toBe("https://bank.example/");
  });

  it("maps an extracted Gmail email onto the scanner contract", () => {
    const body = toRequest(
      {
        kind: "email",
        email: {
          provider: "gmail",
          subject: "Verifiko llogarinë",
          sender: "Banka <x@evil.test>",
          body: "Kliko këtu",
          links: [{ href: "https://evil.test/a", text: "bank.example" }, { href: "https://evil.test/a", text: "again" }],
          attachments: [{ name: "fatura.pdf.exe", mime: "application/x-msdownload", size: 0 }],
          warnings: [],
        },
      },
      "sq",
    );
    expect(body).toMatchObject({ channel: "EMAIL", source: "gmail", email: { urls: ["https://evil.test/a"], sender: "Banka <x@evil.test>" }, options: { locale: "sq" } });
  });

  it("maps SMS, EML and selections", () => {
    expect(toRequest({ kind: "sms", text: "Paguani", sender: "+355690000000" }, "en")).toMatchObject({ channel: "SMS", message: { text: "Paguani", sender: "+355690000000" } });
    expect(toRequest({ kind: "eml", raw: "From: a@b.test\r\n\r\nhi", fileName: "x.eml" }, "sq")).toMatchObject({ channel: "EMAIL", source: "eml", email: { raw: expect.any(String) } });
    expect(toRequest({ kind: "selection", text: "hello", as: "sms" }, "sq")).toMatchObject({ channel: "SMS" });
  });

  it("uses the platform flag thresholds", () => {
    expect([flagFor(10, true), flagFor(25, true), flagFor(45, true), flagFor(65, true), flagFor(85, true), flagFor(85, false)]).toEqual(["green", "yellow", "orange", "red", "darkred", "grey"]);
  });
});
