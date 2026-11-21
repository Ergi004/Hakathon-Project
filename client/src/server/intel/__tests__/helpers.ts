import { readFileSync } from "node:fs";
import path from "node:path";
import type { FetchLike } from "../providers/http";

export const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

/** Fake fetch: routes by URL substring to a canned response. Never touches the network. */
export function fakeFetch(routes: Record<string, { status?: number; body?: string; delayMs?: number }>): FetchLike & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected request to ${url}`);
    const r = routes[key];
    if (r.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, r.delayMs);
        init?.signal?.addEventListener("abort", () => { clearTimeout(t); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
      });
    }
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
  }) as FetchLike & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

export const signal = () => AbortSignal.timeout(2000);
export const shortSignal = () => AbortSignal.timeout(50);
