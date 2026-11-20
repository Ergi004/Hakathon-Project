import { describe, expect, it } from "vitest";
import { analyzeAttachments, fromContent, sniff } from "../channels/email/attachment-analyzer";
import { parseEmail } from "../channels/email/email-parser";
import { analyzeHeaders, parseHeaderBlock, readAuthResults } from "../channels/email/header-analyzer";
import { analyzeHtml } from "../channels/email/html-analyzer";
import { analyzeSmsText, parseSms, parseSmsSender } from "../channels/sms/sms-analyzer";
import { extractIocs, isPrivateIPv4, normalizeUrl } from "../intelligence/ioc-extractor";

const EML = [
  "Return-Path: <bounce@mailer.evil.test>",
  "Authentication-Results: mx.bank.example; spf=fail smtp.mailfrom=evil.test; dkim=none; dmarc=fail header.from=bank.example",
  "Received: from mailer.evil.test by mx.bank.example",
  "From: Banka Shembull <security@bank.example>",
  "Reply-To: help@freemail.test",
  "Message-ID: <123@evil.test>",
  "Subject: Verifikoni llogarine tuaj",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b1"',
  "",
  "--b1",
  "Content-Type: text/html; charset=utf-8",
  "",
  '<p>Llogaria juaj do te bllokohet sot.</p><a href="http://bank-login.evil.test/x">https://www.bank.example/login</a><form action="http://collect.evil.test/p"><input type="password"></form>',
  "--b1",
  'Content-Type: application/pdf; name="fatura.pdf"',
  'Content-Disposition: attachment; filename="fatura.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  Buffer.from("MZ\x90\x00 fake executable").toString("base64"),
  "--b1--",
  "",
].join("\r\n");

describe("header analysis (PDF §7.1)", () => {
  it("reads SPF/DKIM/DMARC from Authentication-Results, never from a DNS guess", () => {
    const h = parseHeaderBlock(EML);
    expect(readAuthResults(h)).toEqual({ spf: "fail", dkim: "none", dmarc: "fail", source: "authentication-results" });
    expect(readAuthResults(new Map()).source).toBe("absent");
  });

  it("flags Reply-To, Return-Path and Message-ID mismatches", () => {
    const codes = analyzeHeaders(parseHeaderBlock(EML)).findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["spf_fail", "dmarc_fail", "reply_to_mismatch", "return_path_mismatch", "message_id_mismatch"]));
  });

  it("flags display names that embed another domain", () => {
    const h = parseHeaderBlock('From: "support@paypal.example" <x@evil.test>\r\n\r\n');
    expect(analyzeHeaders(h).findings.map((f) => f.code)).toContain("display_name_spoof");
  });
});

describe("HTML analysis", () => {
  it("detects link-text mismatch, forms and password fields without rendering", () => {
    const r = analyzeHtml('<a href="http://evil.test/a">www.bank.example</a><form action="https://x.test"><input type=password></form>');
    expect(r.hrefs[0]).toEqual({ href: "http://evil.test/a", display: "www.bank.example" });
    expect(r.findings.map((f) => f.code)).toEqual(expect.arrayContaining(["link_text_mismatch", "html_form", "password_field"]));
  });
});

describe("attachments", () => {
  it("sniffs magic bytes and flags a disguised executable", () => {
    const a = fromContent("invoice.pdf", "application/pdf", new Uint8Array([0x4d, 0x5a, 0x90, 0]));
    expect(a.detectedType).toBe("pe_executable");
    expect(a.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(analyzeAttachments([a])[0].code).toBe("disguised_executable");
    expect(sniff(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe("pdf");
  });
});

describe("EML parsing", () => {
  it("parses a raw EML end to end and hashes attachments without keeping bytes", async () => {
    const m = await parseEmail({ raw: EML, urls: [], attachments: [] }, "eml", "sq");
    expect(m.channel).toBe("email");
    expect(m.subject).toBe("Verifikoni llogarine tuaj");
    expect(m.auth.dmarc).toBe("fail");
    expect(m.attachments[0]).toMatchObject({ name: "fatura.pdf", detectedType: "pe_executable" });
    expect(m.attachments[0]).not.toHaveProperty("content");
    expect(m.headerFindings.map((f) => f.code)).toEqual(expect.arrayContaining(["disguised_executable", "link_text_mismatch", "password_field"]));
  });
});

describe("SMS analysis (PDF §19)", () => {
  it("classifies senders", () => {
    expect(parseSmsSender("+355 69 123 4567")).toMatchObject({ kind: "e164", normalized: "+355691234567", international: false });
    expect(parseSmsSender("0044 7700 900123")).toMatchObject({ kind: "e164", international: true });
    expect(parseSmsSender("54321").kind).toBe("short_code");
    expect(parseSmsSender("POSTA").kind).toBe("alphanumeric");
    expect(parseSmsSender("").kind).toBe("absent");
  });

  it("detects bidi overrides, homoglyphs, APK lures and OTP requests", () => {
    const s = parseSmsSender("+355691234567");
    const codes = (t: string) => analyzeSmsText(t, s).map((f) => f.code);
    expect(codes("Kliko ‮gnp.exe")).toContain("rtl_override");
    expect(codes("Hyni ne pаypal tani")).toContain("mixed_script"); // Cyrillic а
    expect(codes("Shkarko aplikacionin APK per te marre paketen")).toContain("app_install_lure");
    expect(codes("Na dergo kodin OTP qe more")).toContain("otp_request");
    expect(codes("Telefononi 069 123 4567 per rimbursim")).toContain("callback_lure");
  });
});

describe("IOC extraction (PDF §7.2)", () => {
  it("normalises, de-duplicates and keeps source locations", () => {
    const sms = parseSms({ text: "Paketa juaj: paguani ne hxxps://posta-al[.]test/pay ose https://posta-al.test/pay. IP 10.0.0.1, 8.8.8.8", sender: "+355691234567" }, "manual_input", "sq");
    const iocs = extractIocs(sms);
    const urls = iocs.filter((i) => i.type === "url");
    expect(urls).toHaveLength(1);
    expect(urls[0].normalized).toBe("https://posta-al.test/pay");
    expect(urls[0].display).toBe("hxxps://posta-al[.]test/pay");
    expect(iocs.find((i) => i.type === "domain")?.normalized).toBe("posta-al.test");
    expect(iocs.filter((i) => i.type === "ip").map((i) => i.normalized)).toEqual(["10.0.0.1", "8.8.8.8"]);
    expect(iocs.find((i) => i.type === "phone_number")).toMatchObject({ normalized: "+355691234567", locations: ["sender"] });
  });

  it("rejects non-http schemes and recognises private ranges", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(isPrivateIPv4("192.168.1.1")).toBe(true);
    expect(isPrivateIPv4("169.254.169.254")).toBe(true);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
  });
});
