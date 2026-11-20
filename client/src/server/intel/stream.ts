import type { ScanSnapshot } from "./snapshot";

/**
 * Turns repeated snapshots into an SSE stream. Pure apart from timers, so it is
 * unit-tested with a fake snapshot source. Emits rows in the order they finish.
 */
export function streamScan(
  load: () => Promise<ScanSnapshot | null>,
  opts: { signal?: AbortSignal; intervalMs?: number; maxMs?: number; heartbeatMs?: number } = {},
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const interval = opts.intervalMs ?? 400;
  const maxMs = opts.maxMs ?? 320_000;
  const heartbeat = opts.heartbeatMs ?? 15_000;
  let closed = false;

  return new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      opts.signal?.addEventListener("abort", close, { once: true });

      const seen = new Map<string, string>();
      let lastScore: number | null | undefined;
      let lastSubs = -1;
      let lastBeat = Date.now();
      const started = Date.now();
      send("hello", { at: new Date().toISOString() });

      while (!closed) {
        const snap = await load().catch(() => null);
        if (!snap) {
          send("error", { message: "not_found" });
          break;
        }
        if (seen.size === 0) send("scan", snap.scan);
        for (const r of snap.results) {
          const sig = `${r.status}:${r.verdict}:${r.finishedAt ?? ""}`;
          if (r.status !== "pending" && seen.get(r.key) !== sig) {
            seen.set(r.key, sig);
            send("result", r);
          } else if (!seen.has(r.key)) {
            seen.set(r.key, "pending");
            send("pending", { key: r.key, provider: r.provider, tier: r.tier });
          }
        }
        if (snap.subdomains.length !== lastSubs) {
          lastSubs = snap.subdomains.length;
          if (lastSubs > 0) send("subdomains", snap.subdomains);
        }
        if (snap.scan.finalScore !== lastScore) {
          lastScore = snap.scan.finalScore;
          send("score", { score: snap.scan.finalScore, base: snap.scan.baseScore, domainAgeDays: snap.scan.domainAgeDays, registeredAt: snap.scan.registeredAt, verdict: snap.scan.verdict });
        }
        if (snap.scan.status !== "running") {
          send("done", { status: snap.scan.status, verdict: snap.scan.verdict, score: snap.scan.finalScore });
          break;
        }
        if (Date.now() - started > maxMs) {
          send("done", { status: "timeout" });
          break;
        }
        if (Date.now() - lastBeat > heartbeat) {
          if (!closed) controller.enqueue(enc.encode(": keep-alive\n\n"));
          lastBeat = Date.now();
        }
        await new Promise((r) => setTimeout(r, interval));
      }
      close();
    },
    cancel() {
      closed = true;
    },
  });
}
