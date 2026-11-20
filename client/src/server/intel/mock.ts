/**
 * INTEL_MODE=mock (default): believable canned results so the demo works with the
 * synthetic dataset (.example/.test domains do not exist on the internet).
 * F019 campaign domains come back malicious, about 4 days old, with 3-6 subdomains,
 * using staggered delays so live streaming is visible. Any other host: clean/unknown, young.
 */
import type { IntelProviderName, ProviderResult } from "./types";

export const F019_HOSTS = ["pogrdec.test", "xn--pogradc-dhg.al.test", "opgradec.info.example", "pogradec-fines-gov.al.example"];

const DELAYS: Record<IntelProviderName | "internal" | "subdomains", number> = {
  dns: 400, rdap: 900, urlhaus: 1500, crtsh: 2300, virustotal: 3200, hybrid_analysis: 5000, internal: 250, subdomains: 4200,
};

export function isF019(host: string, registrable: string) {
  return F019_HOSTS.some((h) => host === h || registrable === h || host.endsWith(`.${h}`));
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

export function mockDelay(p: IntelProviderName | "internal" | "subdomains") {
  return DELAYS[p];
}

export function mockResult(provider: IntelProviderName, host: string, registrable: string, deep = false): ProviderResult {
  const bad = isF019(host, registrable);
  switch (provider) {
    case "dns":
      return { provider, status: "done", verdict: "unknown", summary: { resolves: bad, addresses: bad ? ["203.0.113.24"] : [] } };
    case "rdap":
      return { provider, status: "done", verdict: "unknown", summary: { registeredAt: daysAgo(bad ? 4 : 12), expiresAt: daysAgo(bad ? -361 : -353), registrar: bad ? "Regjistruesi Shembull 2" : "Example Registrar", privacy: bad } };
    case "urlhaus":
      return bad
        ? { provider, status: "done", verdict: "malicious", maliciousCount: 7, summary: { listed: true, urlCount: 7, threats: ["phishing"], firstSeen: daysAgo(3), blacklists: { spamhaus_dbl: "abused_legit_phishing" } }, reportUrl: "https://urlhaus.abuse.ch/" }
        : { provider, status: "done", verdict: "clean", summary: { listed: false, urlCount: 0, threats: [], blacklists: {} } };
    case "crtsh":
      return { provider, status: "done", verdict: "unknown", summary: { firstCertAt: daysAgo(bad ? 4 : 11), count: bad ? 5 : 1, names: mockSubdomains(registrable).map((n) => ({ name: n, firstSeen: daysAgo(bad ? 4 : 11) })) } };
    case "virustotal":
      return bad
        ? { provider, status: "done", verdict: "malicious", maliciousCount: deep ? 14 : 11, totalCount: 92, summary: { malicious: deep ? 14 : 11, suspicious: 3, harmless: 49, undetected: 29, creationDate: daysAgo(4), categories: ["phishing", "fraud"], ...(deep ? { deep: true } : {}) }, reportUrl: "https://www.virustotal.com/gui/home" }
        : { provider, status: "done", verdict: "clean", maliciousCount: 0, totalCount: 92, summary: { malicious: 0, suspicious: 0, harmless: 63, undetected: 29, creationDate: daysAgo(12), categories: [] } };
    case "hybrid_analysis":
      return bad
        ? { provider, status: "done", verdict: "malicious", maliciousCount: 3, totalCount: 4, summary: { verdict: "malicious", threatScore: 92, state: "SUCCESS" }, reportUrl: "https://www.hybrid-analysis.com/" }
        : { provider, status: "done", verdict: "clean", summary: { verdict: "no specific threat", threatScore: 4, state: "SUCCESS" } };
  }
}

export function mockSubdomains(registrable: string): string[] {
  const base = registrable;
  if (registrable.startsWith("pogradec") || registrable.startsWith("xn--pogradc") || registrable.startsWith("pogrdec") || registrable.startsWith("opgradec")) {
    return ["pagesa", "login", "gjoba", "verify", "e-albania", "www"].map((p) => `${p}.${base}`);
  }
  return [`www.${base}`];
}
