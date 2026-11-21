import { describe, expect, it } from "vitest";
import { parsePasted } from "../paste";

describe("parsePasted", () => {
  it("reads an English email header block", () => {
    const r = parsePasted("From: e-Albania <noreply@e-albania-fix.example>\nTo: you@example.com\nSubject: Account update\nReply-To: help@mail.example\n\nDear citizen, update now: https://e-albania-fix.example/login");
    expect(r.kind).toBe("email");
    expect(r.sender).toBe("e-Albania <noreply@e-albania-fix.example>");
    expect(r.subject).toBe("Account update");
    expect(r.replyTo).toBe("help@mail.example");
    expect(r.body).toBe("Dear citizen, update now: https://e-albania-fix.example/login");
  });

  it("reads Albanian headers and a forwarded block", () => {
    const r = parsePasted("---------- Forwarded message ---------\nNga: Posta Shqiptare <info@posta-al.example>\nData: 21 nëntor 2026\nTema: Pakoja juaj\n\nPaguani tarifën: https://posta-al.example/pay");
    expect(r.kind).toBe("email");
    expect(r.sender).toContain("Posta Shqiptare");
    expect(r.subject).toBe("Pakoja juaj");
    expect(r.body.startsWith("Paguani")).toBe(true);
  });

  it("keeps an SMS as a message", () => {
    const r = parsePasted("Posta: Pakoja juaj është bllokuar. Paguani: hxxps://posta-al[.]example/pay");
    expect(r).toEqual({ kind: "message", body: "Posta: Pakoja juaj është bllokuar. Paguani: hxxps://posta-al[.]example/pay" });
  });

  it("does not treat a lone 'Data:' line in an SMS as an email", () => {
    expect(parsePasted("Data: 12.05\nKeni një gjobë. Paguani sot.").kind).toBe("message");
  });

  it("detects a bare link and a bare phone number", () => {
    expect(parsePasted("hxxps://pay-fine[.]al[.]example/x").kind).toBe("link");
    expect(parsePasted("  https://example.test/a?b=1 ").kind).toBe("link");
    expect(parsePasted("+355 69 123 4567").kind).toBe("phone");
    expect(parsePasted("069 123 4567").kind).toBe("phone");
  });
});
