import { describe, expect, it } from "vitest";
import type { ScanSnapshot } from "../snapshot";
import { streamScan } from "../stream";

const row = (provider: string, status: string, verdict = "unknown", at: string | null = null) => ({ key: `A:${provider}`, provider, tier: "A" as const, status, verdict, maliciousCount: null, totalCount: null, summary: {}, reportUrl: null, error: null, finishedAt: at });
const base = (status: string, results: ScanSnapshot["results"], score: number): ScanSnapshot => ({
  scan: { id: "s", status, verdict: "unknown", baseScore: 40, finalScore: score, domainAgeDays: null, registeredAt: null, mock: true, host: "x[.]test", registrableDomain: "x[.]test", deep: false },
  results,
  subdomains: [],
});

async function readAll(stream: ReadableStream<Uint8Array>) {
  const text = await new Response(stream).text();
  return text.split("\n\n").filter(Boolean).map((block) => ({ event: block.match(/^event: (.*)$/m)?.[1], data: block.match(/^data: (.*)$/m)?.[1] }));
}

describe("SSE stream", () => {
  it("delivers rows in order, a score event on change and ends with done", async () => {
    const snaps = [
      base("running", [row("dns", "pending"), row("rdap", "pending")], 40),
      base("running", [row("dns", "done", "unknown", "t1"), row("rdap", "pending")], 40),
      base("running", [row("dns", "done", "unknown", "t1"), row("rdap", "unavailable", "unknown", "t2")], 54),
      base("done", [row("dns", "done", "unknown", "t1"), row("rdap", "unavailable", "unknown", "t2")], 54),
    ];
    let i = 0;
    const events = await readAll(streamScan(async () => snaps[Math.min(i++, snaps.length - 1)], { intervalMs: 1 }));
    const names = events.map((e) => e.event);
    expect(names[0]).toBe("hello");
    const results = events.filter((e) => e.event === "result").map((e) => JSON.parse(e.data!).provider);
    expect(results).toEqual(["dns", "rdap"]);
    const scores = events.filter((e) => e.event === "score").map((e) => JSON.parse(e.data!).score);
    expect(scores).toEqual([40, 54]);
    expect(names.at(-1)).toBe("done");
    expect(names.indexOf("done")).toBeGreaterThan(names.lastIndexOf("result"));
  });
  it("one failing provider still lets the scan finish", async () => {
    const events = await readAll(streamScan(async () => base("done", [row("virustotal", "unavailable", "unknown", "t"), row("dns", "done", "unknown", "t")], 40), { intervalMs: 1 }));
    expect(events.filter((e) => e.event === "result")).toHaveLength(2);
    expect(events.at(-1)?.event).toBe("done");
  });
  it("ends with an error event when the scan is gone", async () => {
    const events = await readAll(streamScan(async () => null, { intervalMs: 1 }));
    expect(events.map((e) => e.event)).toEqual(["hello", "error"]);
  });
});
