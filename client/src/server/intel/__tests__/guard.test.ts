import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../cache", () => ({ cacheKey: (p: string, s: string) => `${p}:${s}`, cacheGet: async () => null, cacheSet: async () => {} }));
vi.mock("@/server/detection/load-context", () => ({ loadContext: async () => ({ officialDomains: new Map(), institutions: new Map() }) }));
vi.mock("@/server/db", () => ({ tryAdmin: () => null }));

const { guarded } = await import("../orchestrator");
const { resetLimits } = await import("../limits");

describe("provider guard", () => {
  beforeEach(() => resetLimits());

  it("a throwing provider becomes unavailable instead of failing the scan", async () => {
    const r = await guarded("urlhaus", "x.com", async () => { throw Object.assign(new Error("boom"), { name: "TypeError" }); });
    expect(r).toMatchObject({ provider: "urlhaus", status: "unavailable" });
  });

  it("Promise.allSettled over providers completes when one fails", async () => {
    const settled = await Promise.allSettled([
      guarded("dns", "x.com", async () => ({ provider: "dns", status: "done", verdict: "unknown", summary: { resolves: true } })),
      guarded("urlhaus", "x.com", async () => { throw new Error("down"); }),
    ]);
    expect(settled.every((s) => s.status === "fulfilled")).toBe(true);
    expect(settled.map((s) => (s as PromiseFulfilledResult<{ status: string }>).value.status)).toEqual(["done", "unavailable"]);
  });

  it("opens the circuit after 3 consecutive failures", async () => {
    for (let i = 0; i < 3; i++) await guarded("crtsh", `d${i}.com`, async () => { throw new Error("x"); });
    const r = await guarded("crtsh", "ok.com", async () => ({ provider: "crtsh", status: "done", verdict: "unknown", summary: {} }));
    expect(r).toMatchObject({ status: "unavailable", error: "circuit_open" });
  });

  it("returns unavailable instead of waiting when the token bucket is empty (VirusTotal 4/min)", async () => {
    const ok = async () => ({ provider: "virustotal" as const, status: "done" as const, verdict: "clean" as const, summary: {} });
    const out = [];
    for (let i = 0; i < 5; i++) out.push(await guarded("virustotal", `v${i}.com`, ok));
    expect(out.slice(0, 4).every((r) => r.status === "done")).toBe(true);
    expect(out[4]).toMatchObject({ status: "unavailable", error: "rate_limited" });
  });

  it("a hanging provider times out as unavailable", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const p = guarded("rdap", "slow.com", () => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(9000);
    expect(await p).toMatchObject({ status: "unavailable", error: "timeout" });
    vi.useRealTimers();
  });
});
