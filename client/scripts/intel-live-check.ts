/** One harmless live lookup per provider (example.org). Prints normalised summaries only, never keys or raw payloads. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { createCrtsh } from "../src/server/intel/providers/crtsh";
import { createDns } from "../src/server/intel/providers/dns";
import { createRdap } from "../src/server/intel/providers/rdap";
import { createUrlhaus } from "../src/server/intel/providers/urlhaus";
import { createVirusTotal } from "../src/server/intel/providers/virustotal";

const domain = process.argv[2] ?? "example.org";
const sig = () => AbortSignal.timeout(15000);
const show = (r: { provider: string; status: string; verdict: string; maliciousCount?: number; totalCount?: number; summary: Record<string, unknown>; error?: string }) =>
  console.log(JSON.stringify({ provider: r.provider, status: r.status, verdict: r.verdict, malicious: r.maliciousCount, total: r.totalCount, error: r.error, summary: { ...r.summary, names: Array.isArray(r.summary.names) ? `${(r.summary.names as unknown[]).length} names` : undefined } }));

async function main() {
const vt = process.env.VIRUS_TOTAL_API_KEY ? createVirusTotal(process.env.VIRUS_TOTAL_API_KEY) : null;
const uh = process.env.AUTH_ABUSE_API_KEY ? createUrlhaus(process.env.AUTH_ABUSE_API_KEY) : null;
const results = await Promise.all([
  createDns().host(domain, sig()),
  createRdap().domain(domain, sig()),
  createCrtsh().domain(domain, sig()),
  uh ? uh.host(domain, sig()) : Promise.resolve({ provider: "urlhaus", status: "skipped", verdict: "unknown", summary: {}, error: "no key" }),
  vt ? vt.domainReport(domain, sig()) : Promise.resolve({ provider: "virustotal", status: "skipped", verdict: "unknown", summary: {}, error: "no key" }),
]);
results.forEach(show);
if (vt) console.log(JSON.stringify({ provider: "virustotal-subdomains", count: (await vt.subdomains(domain, sig(), 5)).length }));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
