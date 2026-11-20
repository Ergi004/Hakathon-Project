import { describe, expect, it } from "vitest";
import { emailFacts, progressOf, providerDetail } from "../src/lib/pipeline";
import type { ScanView } from "../src/lib/types";

const t = (k: string, sub?: string[]) => `${k}${sub ? `(${sub.join(",")})` : ""}`;
const base = (steps: ScanView["steps"], rows: { status: string }[] = []) =>
  ({ steps, intel: { mock: false, deep: false, domains: [{ host: "a", status: "running", domainAgeDays: null, finalScore: null, subdomains: 0, rows: rows.map((r, i) => ({ key: String(i), provider: "dns", tier: "A" as const, verdict: "unknown", ...r })) }] } });

describe("progress", () => {
  it("rises through the steps and reaches 100", () => {
    const a = progressOf(base({ read: "done", local: "done", engine: "active", intel: "pending", report: "pending" }));
    const b = progressOf(base({ read: "done", local: "done", engine: "done", intel: "active", report: "pending" }, [{ status: "done" }, { status: "pending" }]));
    const c = progressOf(base({ read: "done", local: "done", engine: "done", intel: "done", report: "done" }));
    expect(a).toBeLessThan(b);
    expect(b).toBe(70);
    expect(c).toBe(100);
  });
});

describe("provider details", () => {
  it("turns normalised summaries into one line", () => {
    expect(providerDetail("virustotal", "done", {}, { malicious: 7, total: 92 }, t)).toBe("d_engines(7,92)");
    expect(providerDetail("urlhaus", "done", { listed: true, urlCount: 3 }, { malicious: null, total: null }, t)).toBe("d_listed(3)");
    expect(providerDetail("rdap", "done", { registeredAt: "2026-11-16", registrar: "R", privacy: true }, { malicious: null, total: null }, t)).toBe("d_registered(2026-11-16) · R · d_privacy");
    expect(providerDetail("dns", "pending", {}, { malicious: null, total: null }, t)).toBeUndefined();
  });
  it("summarises what was found in the email", () => {
    expect(emailFacts({ client: "gmail", sender: "x@Bad.example", text: "", attachments: [], links: [{ href: "https://www.a.example/x?q=1", text: "" }, { href: "https://a.example/y", text: "" }, { href: "mailto:x", text: "" }] }))
      .toEqual({ links: 3, domains: ["a[.]example"], attachments: 0, senderDomain: "bad[.]example" });
  });
});
