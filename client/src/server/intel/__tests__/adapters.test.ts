import { describe, expect, it } from "vitest";
import { createCrtsh } from "../providers/crtsh";
import { createDns } from "../providers/dns";
import { createHybridAnalysis } from "../providers/hybrid-analysis";
import { createRdap } from "../providers/rdap";
import { createUrlhaus } from "../providers/urlhaus";
import { createVirusTotal } from "../providers/virustotal";
import { fakeFetch, fixture, shortSignal, signal } from "./helpers";

const QUOTA = { status: 429, body: JSON.stringify({ error: { code: "QuotaExceededError", message: "quota" } }) };
const MALFORMED = { body: "<html>not json" };
const SLOW = { delayMs: 500, body: "{}" };

describe("VirusTotal adapter", () => {
  it("normalises a domain report and sends the x-apikey header", async () => {
    const f = fakeFetch({ "/domains/bad-login.example.com": { body: fixture("virustotal-domain.json") } });
    const r = await createVirusTotal("KEY", f).domainReport("bad-login.example.com", signal());
    expect(r).toMatchObject({ provider: "virustotal", status: "done", verdict: "malicious", maliciousCount: 7, totalCount: 88 });
    expect(r.summary).toMatchObject({ creationDate: "2025-11-16", registrar: "Example Registrar, Inc." });
    expect((r.summary.categories as string[]).length).toBeGreaterThan(0);
    expect(r.summary).not.toHaveProperty("whois");
    expect((f.calls[0].init?.headers as Record<string, string>)["x-apikey"]).toBe("KEY");
  });
  it("quota error (429) becomes unavailable", async () => {
    const r = await createVirusTotal("K", fakeFetch({ "/domains/": QUOTA })).domainReport("x.com", signal());
    expect(r).toMatchObject({ status: "unavailable", error: "quota" });
  });
  it("timeout becomes unavailable", async () => {
    const r = await createVirusTotal("K", fakeFetch({ "/domains/": SLOW })).domainReport("x.com", shortSignal());
    expect(r).toMatchObject({ status: "unavailable", error: "timeout" });
  });
  it("malformed answer becomes unavailable", async () => {
    expect((await createVirusTotal("K", fakeFetch({ "/domains/": MALFORMED })).domainReport("x.com", signal())).status).toBe("unavailable");
    expect((await createVirusTotal("K", fakeFetch({ "/domains/": { body: "{\"data\":{}}" } })).domainReport("x.com", signal())).status).toBe("unavailable");
  });
  it("lists subdomains and reads a completed URL analysis", async () => {
    const vt = createVirusTotal("K", fakeFetch({ "/subdomains": { body: fixture("virustotal-subdomains.json") }, "/analyses/": { body: fixture("virustotal-analysis.json") } }));
    expect(await vt.subdomains("bad-login.example.com", signal())).toEqual(["login.bad-login.example.com", "pay.bad-login.example.com"]);
    expect(await vt.pollAnalysis("u-abc-123", signal())).toMatchObject({ verdict: "malicious", maliciousCount: 4 });
  });
});

describe("URLhaus adapter", () => {
  it("listed host → malicious with Auth-Key header and form body", async () => {
    const f = fakeFetch({ "/v1/host/": { body: fixture("urlhaus-host.json") } });
    const r = await createUrlhaus("AK", f).host("bad.example.com", signal());
    expect(r).toMatchObject({ status: "done", verdict: "malicious", maliciousCount: 3 });
    expect(r.summary).toMatchObject({ listed: true, threats: ["malware_download"], blacklists: { spamhaus_dbl: "abused_legit_phishing" } });
    expect((f.calls[0].init?.headers as Record<string, string>)["Auth-Key"]).toBe("AK");
    expect(f.calls[0].init?.body).toBe("host=bad.example.com");
  });
  it("no_results → clean", async () => {
    const r = await createUrlhaus("AK", fakeFetch({ "/v1/host/": { body: "{\"query_status\":\"no_results\"}" } })).host("ok.com", signal());
    expect(r).toMatchObject({ status: "done", verdict: "clean" });
  });
  it("429, timeout and malformed → unavailable", async () => {
    for (const [route, sig] of [[QUOTA, signal()], [SLOW, shortSignal()], [MALFORMED, signal()]] as const) {
      const r = await createUrlhaus("AK", fakeFetch({ "/v1/host/": route })).host("x.com", sig);
      expect(r.status).toBe("unavailable");
    }
  });
});

describe("RDAP adapter", () => {
  it("uses the IANA bootstrap and reads registration, expiry, registrar and privacy", async () => {
    const f = fakeFetch({ "data.iana.org": { body: fixture("iana-dns.json") }, "rdap.verisign.example/com/v1/domain/bad-login.com": { body: fixture("rdap-domain.json") } });
    const r = await createRdap(f).domain("bad-login.com", signal());
    expect(r.summary).toEqual({ registeredAt: "2026-11-16", expiresAt: "2027-11-16", registrar: "Example Registrar, Inc.", privacy: true });
  });
  it("429, timeout and malformed → unavailable", async () => {
    for (const [route, sig] of [[QUOTA, signal()], [SLOW, shortSignal()], [MALFORMED, signal()]] as const) {
      const r = await createRdap(fakeFetch({ "data.iana.org": { body: fixture("iana-dns.json") }, "/domain/": route })).domain("x.com", sig);
      expect(r.status).toBe("unavailable");
    }
  });
});

describe("crt.sh adapter", () => {
  it("collects names, drops wildcards, emails and foreign names, keeps the first certificate date", async () => {
    const r = await createCrtsh(fakeFetch({ "crt.sh": { body: fixture("crtsh.json") } })).domain("bad-login.example.com", signal());
    const names = (r.summary.names as { name: string }[]).map((n) => n.name).sort();
    expect(names).toEqual(["bad-login.example.com", "login.bad-login.example.com", "secure-verify.bad-login.example.com"]);
    expect(r.summary.firstCertAt).toBe("2026-11-16");
  });
  it("429, timeout and malformed → unavailable", async () => {
    for (const [route, sig] of [[QUOTA, signal()], [SLOW, shortSignal()], [MALFORMED, signal()]] as const) {
      expect((await createCrtsh(fakeFetch({ "crt.sh": route })).domain("x.com", sig)).status).toBe("unavailable");
    }
  });
});

describe("Hybrid Analysis adapter", () => {
  it("reads a finished quick scan defensively and sends the api-key header", async () => {
    const f = fakeFetch({ "/quick-scan/64a1": { body: fixture("hybrid-quick-scan.json") } });
    const r = await createHybridAnalysis("HK", f).poll("64a1f0c2e5b0c1d2", signal());
    expect(r).toMatchObject({ status: "done", verdict: "malicious", summary: { threatScore: 85 } });
    expect((f.calls[0].init?.headers as Record<string, string>)["api-key"]).toBe("HK");
  });
  it("still running → null; quota message → throws quota; malformed → throws", async () => {
    expect(await createHybridAnalysis("HK", fakeFetch({ "/quick-scan/": { body: "{\"finished\":false}" } })).poll("id", signal())).toBeNull();
    await expect(createHybridAnalysis("HK", fakeFetch({ "/quick-scan/": { status: 400, body: "{\"message\":\"Exceeded maximum API requests per minute\"}" } })).poll("id", signal())).rejects.toMatchObject({ status: 429 });
    await expect(createHybridAnalysis("HK", fakeFetch({ "/quick-scan/": MALFORMED })).poll("id", signal())).rejects.toBeTruthy();
    await expect(createHybridAnalysis("HK", fakeFetch({ "/quick-scan/": { body: "{}" } })).poll("id", signal())).rejects.toBeTruthy();
  });
  it("timeout rejects (orchestrator turns it into unavailable)", async () => {
    await expect(createHybridAnalysis("HK", fakeFetch({ "/quick-scan/": SLOW })).poll("id", shortSignal())).rejects.toBeTruthy();
  });
});

describe("DNS adapter", () => {
  it("resolves, fails closed and respects the timeout", async () => {
    const ok = createDns({ resolve4: async () => ["203.0.113.5"], resolve6: async () => [] });
    expect((await ok.host("a.com", signal())).summary).toEqual({ resolves: true, addresses: ["203.0.113.5"] });
    const fail = createDns({ resolve4: async () => { throw new Error("ENOTFOUND"); }, resolve6: async () => { throw new Error("ENOTFOUND"); } });
    expect((await fail.host("nx.com", signal())).summary).toEqual({ resolves: false, addresses: [] });
    const slow = createDns({ resolve4: () => new Promise(() => {}), resolve6: () => new Promise(() => {}) });
    expect((await slow.host("slow.com", shortSignal())).summary).toEqual({ resolves: false, addresses: [] });
  });
});
