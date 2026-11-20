import { describe, expect, it } from "vitest";
import { DEFAULT_THRESHOLDS } from "@/lib/flags";
import { reason } from "@/server/detection/reasons";
import { sanitizeForIntel } from "../sanitize";
import { foldIntel, intelVerdictReasons, lifetimeReasons, rankSubdomains, subdomainReasons } from "../scoring";
import type { ProviderResult } from "../types";

describe("sanitizeForIntel", () => {
  it("strips userinfo, query and fragment; keeps scheme://host/path", () => {
    const r = sanitizeForIntel("https://user:pw@Bad-Login.com/pay/now?id=42&email=a@b.c#frag");
    expect(r).toMatchObject({ ok: true, url: "https://bad-login.com/pay/now", host: "bad-login.com", registrableDomain: "bad-login.com" });
  });
  it("sends host only when the path looks personal", () => {
    expect(sanitizeForIntel("https://x.com/u/0691234567/pay")).toMatchObject({ ok: true, url: "https://x.com/" });
    expect(sanitizeForIntel("https://x.com/reset/ana@mail.com")).toMatchObject({ ok: true, url: "https://x.com/" });
  });
  it("accepts defanged input", () => {
    expect(sanitizeForIntel("hxxps://bad[.]com/a")).toMatchObject({ ok: true, url: "https://bad.com/a" });
  });
  it("skips private IPs, localhost and .local", () => {
    for (const u of ["http://192.168.1.10/x", "http://10.0.0.1", "http://127.0.0.1:8080", "http://localhost/x", "http://printer.local/", "http://[::1]/"]) {
      expect(sanitizeForIntel(u)).toMatchObject({ ok: false, reason: "private" });
    }
  });
  it("never submits official or allowlisted domains", () => {
    expect(sanitizeForIntel("https://pagesa.e-albania.al/x", { officialDomains: ["e-albania.al"] })).toMatchObject({ ok: false, reason: "official" });
    expect(sanitizeForIntel("https://shop.mybank.com", { allowlisted: ["mybank.com"] })).toMatchObject({ ok: false, reason: "allowlisted" });
  });
  it("only http and https; synthetic domains only in mock mode", () => {
    expect(sanitizeForIntel("ftp://x.com/a")).toMatchObject({ ok: false, reason: "scheme" });
    expect(sanitizeForIntel("javascript:alert(1)")).toMatchObject({ ok: false });
    expect(sanitizeForIntel("https://pogrdec.test/x", { mode: "live" })).toMatchObject({ ok: false, reason: "synthetic" });
    expect(sanitizeForIntel("https://pogrdec.test/x", { mode: "mock" })).toMatchObject({ ok: true, synthetic: true });
  });
});

describe("domain lifetime scoring", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  const weight = (code: string, rs: ReturnType<typeof lifetimeReasons>["reasons"]) => rs.find((r) => r.code === code)?.weight;
  it("age buckets: <7 → 14, 7-29 → 10, 30-89 → 5, ≥90 → 0", () => {
    expect(weight("domain_age", lifetimeReasons({ domain: "a.com", registeredAt: days(3), now }).reasons)).toBe(14);
    expect(weight("domain_age", lifetimeReasons({ domain: "a.com", registeredAt: days(7), now }).reasons)).toBe(10);
    expect(weight("domain_age", lifetimeReasons({ domain: "a.com", registeredAt: days(45), now }).reasons)).toBe(5);
    expect(weight("domain_age", lifetimeReasons({ domain: "a.com", registeredAt: days(400), now }).reasons)).toBeUndefined();
  });
  it("unknown age adds 3 and is never treated as old", () => {
    const r = lifetimeReasons({ domain: "a.com", registeredAt: null, now });
    expect(r.ageDays).toBeNull();
    expect(weight("age_unknown", r.reasons)).toBe(3);
  });
  it("cert within 48 h of registration, privacy under 90 days, expiry within 30 days, risky infra", () => {
    const r = lifetimeReasons({ domain: "a.com", registeredAt: days(5), firstCertAt: days(4), privacy: true, expiresAt: new Date(now.getTime() + 10 * 86_400_000).toISOString(), riskyInfra: true, now }).reasons;
    expect(weight("cert_fast", r)).toBe(4);
    expect(weight("whois_privacy", r)).toBe(2);
    expect(weight("expires_soon", r)).toBe(2);
    expect(weight("infra_pattern", r)).toBe(3);
    expect(weight("whois_privacy", lifetimeReasons({ domain: "a.com", registeredAt: days(200), privacy: true, now }).reasons)).toBeUndefined();
  });
});

describe("subdomains", () => {
  it("ranks brand tokens and risky words first and caps at 50", () => {
    const names: { name: string; source: "crtsh" | "virustotal" }[] = Array.from({ length: 80 }, (_, i) => ({ name: `n${i}.bad.com`, source: "crtsh" }));
    names.push({ name: "e-albania-login.bad.com", source: "virustotal" }, { name: "*.bad.com", source: "crtsh" }, { name: "n1.bad.com", source: "virustotal" });
    const ranked = rankSubdomains(names, ["e-albania"]);
    expect(ranked).toHaveLength(50);
    expect(ranked[0]).toMatchObject({ name: "e-albania-login.bad.com", brandToken: true });
    expect(ranked.some((r) => r.name.includes("*"))).toBe(false);
    expect(new Set(ranked.map((r) => r.name)).size).toBe(50);
  });
  it("only the top 10 are eligible for VirusTotal (orchestrator uses index < 10)", () => {
    const ranked = rankSubdomains(Array.from({ length: 30 }, (_, i) => ({ name: `s${i}.x.com`, source: "crtsh" as const })), []);
    expect(ranked.slice(0, 10)).toHaveLength(10);
  });
  it("subdomain trick +8 and farm +6", () => {
    const subs = Array.from({ length: 5 }, (_, i) => ({ name: `e-albania${i}.evil.com`, brandToken: true }));
    const r = subdomainReasons("evil.com", subs, false);
    expect(r.find((x) => x.code === "subdomain_trick")?.weight).toBe(8);
    expect(r.find((x) => x.code === "subdomain_farm")?.weight).toBe(6);
    expect(subdomainReasons("e-albania.al", subs, true)).toEqual([]);
  });
});

describe("folding intelligence into the score", () => {
  const T = DEFAULT_THRESHOLDS;
  const vt = (m: number): ProviderResult => ({ provider: "virustotal", status: "done", verdict: m >= 3 ? "malicious" : m ? "suspicious" : "clean", maliciousCount: m, totalCount: 90, summary: {} });
  it("floor 80: URLhaus listing, VT ≥3, HA ≥70 or malicious subdomain", () => {
    expect(intelVerdictReasons([{ provider: "urlhaus", status: "done", verdict: "malicious", summary: {} }], [], "x.com").floor).toBe(80);
    expect(intelVerdictReasons([vt(3)], [], "x.com").floor).toBe(80);
    expect(intelVerdictReasons([{ provider: "hybrid_analysis", status: "done", verdict: "clean", summary: { threatScore: 75 } }], [], "x.com").floor).toBe(80);
    expect(intelVerdictReasons([], [{ subdomain: "a.x.com", verdict: "malicious" }], "x.com").floor).toBe(80);
    const f = foldIntel({ baseScore: 30, baseReasons: [], intelReasons: intelVerdictReasons([vt(5)], [], "x.com").reasons, floor: 80, thresholds: T });
    expect(f).toMatchObject({ score: 80, flag: "darkred", delta: 50 });
  });
  it("floor 40: VT 1-2 or HA suspicious", () => {
    expect(intelVerdictReasons([vt(1)], [], "x.com").floor).toBe(40);
    expect(intelVerdictReasons([{ provider: "hybrid_analysis", status: "done", verdict: "suspicious", summary: {} }], [], "x.com").floor).toBe(40);
    expect(foldIntel({ baseScore: 10, baseReasons: [], intelReasons: [], floor: 40, thresholds: T }).flag).toBe("orange");
  });
  it("clean results never lower a score", () => {
    const base = [reason("lookalike_homoglyph", 25, "x"), reason("urgency", 4), reason("threat", 4), reason("unknown_sms_sender", 12)];
    const f = foldIntel({ baseScore: 65, baseReasons: base, intelReasons: intelVerdictReasons([vt(0)], [], "x.com").reasons, floor: 0, thresholds: T });
    expect(f.score).toBe(65);
    expect(f.delta).toBe(0);
  });
  it("lifetime points raise the Links group within its cap of 30", () => {
    const base = [reason("lookalike_homoglyph", 25, "x")];
    const f = foldIntel({ baseScore: 25, baseReasons: base, intelReasons: lifetimeReasons({ domain: "x.com", registeredAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }).reasons, floor: 0, thresholds: T });
    expect(f.score).toBe(30);
  });
  it("the official-sender cap is unchanged", () => {
    const f = foldIntel({ baseScore: 12, baseReasons: [reason("official_sender", 0, "Bashkia")], intelReasons: [reason("age_unknown", 3, "x")], floor: 0, thresholds: T });
    expect(f).toMatchObject({ score: 12, delta: 0 });
  });
});
