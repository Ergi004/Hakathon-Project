import { describe, expect, it } from "vitest";
import { containsPii, mask } from "../masks";

describe("mask", () => {
  it("masks phones, IBANs, emails, IDs, cards and names", () => {
    const input =
      "I nderuar Arben Hoxha, telefononi +355 69 123 4567 ose 0682223344. IBAN AL47 2121 1009 0000 0002 3569 8741, email arben@mail.example, NID J12345678A, karta 4111 1111 1111 1111.";
    const { text, counts } = mask(input);
    expect(text).not.toMatch(/Arben|Hoxha|4567|3344|AL47|arben@|J12345678A|4111/);
    expect(counts).toMatchObject({ phone: 2, iban: 1, email: 1, id: 1, card: 1, name: 1 });
    expect(containsPii(text)).toBe(false);
  });

  it("keeps defanged domains and ordinary numbers intact", () => {
    const { text } = mask("Paguani 2500 lekë te 1ezhe-gov[.]al[.]example brenda 24 orëve.");
    expect(text).toBe("Paguani 2500 lekë te 1ezhe-gov[.]al[.]example brenda 24 orëve.");
  });

  it("is idempotent", () => {
    const once = mask("Dear John Smith, call 0691234567").text;
    expect(mask(once).text).toBe(once);
  });
});
