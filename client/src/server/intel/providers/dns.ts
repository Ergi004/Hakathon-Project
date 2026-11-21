/** DNS resolution with node:dns (A + AAAA). Never fetches the site itself. */
import { resolve4, resolve6 } from "node:dns/promises";
import type { DnsSummary, ProviderResult } from "../types";

type Resolver = { resolve4: (h: string) => Promise<string[]>; resolve6: (h: string) => Promise<string[]> };

export function createDns(resolver: Resolver = { resolve4, resolve6 }) {
  async function lookup(host: string, signal: AbortSignal): Promise<DnsSummary> {
    const timeout = new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })), { once: true }));
    const settle = (p: Promise<string[]>) => Promise.race([p, timeout]).catch(() => [] as string[]);
    const [a, aaaa] = await Promise.all([settle(resolver.resolve4(host)), settle(resolver.resolve6(host))]);
    const addresses = [...a, ...aaaa].slice(0, 8);
    return { resolves: addresses.length > 0, addresses };
  }
  async function host(h: string, signal: AbortSignal): Promise<ProviderResult> {
    const s = await lookup(h, signal);
    return { provider: "dns", status: "done", verdict: "unknown", summary: { ...s } };
  }
  return { lookup, host };
}
