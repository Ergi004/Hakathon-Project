"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { IntelPanel, type IntelRow, type IntelState, type IntelSub } from "./intel-panel";

/**
 * Consumes the SSE stream for one scan (anonymous-safe: token protected,
 * normalised data only). EventSource reconnects on its own; after repeated
 * errors we switch to polling the snapshot endpoint.
 */
export function LiveScan({ scanId, token, onScore }: { scanId: string; token: string; onScore?: (score: number) => void }) {
  const [state, setState] = useState<IntelState>({ status: "running", mock: false, rows: [], subdomains: [], domainAgeDays: null, registeredAt: null });
  const [reconnecting, setReconnecting] = useState(false);
  const reportScore = useEffectEvent((score: number) => onScore?.(score));

  useEffect(() => {
    const base = `/api/v1/scan/live/${encodeURIComponent(scanId)}`;
    const qs = `?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = new EventSource(`${base}/stream${qs}`);
    let errors = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    let finished = false;

    const upsert = (row: IntelRow) => setState((s) => ({ ...s, rows: [...s.rows.filter((r) => r.key !== row.key), row] }));
    const applyScore = (d: { score: number | null; domainAgeDays: number | null; registeredAt: string | null }) => {
      setState((s) => ({ ...s, domainAgeDays: d.domainAgeDays, registeredAt: d.registeredAt }));
      if (typeof d.score === "number") reportScore(d.score);
    };

    const applySnapshot = (snap: { scan: { status: string; mock: boolean; finalScore: number | null; domainAgeDays: number | null; registeredAt: string | null }; results: IntelRow[]; subdomains: IntelSub[] }) => {
      setState({ status: snap.scan.status as IntelState["status"], mock: snap.scan.mock, rows: snap.results, subdomains: snap.subdomains, domainAgeDays: snap.scan.domainAgeDays, registeredAt: snap.scan.registeredAt });
      if (typeof snap.scan.finalScore === "number") reportScore(snap.scan.finalScore);
      if (snap.scan.status !== "running" && poll) { clearInterval(poll); poll = null; }
    };

    const startPolling = () => {
      es?.close();
      es = null;
      const tick = async () => {
        try {
          const res = await fetch(`${base}${qs}`, { cache: "no-store" });
          if (res.ok) applySnapshot(await res.json());
        } catch {
          /* keep polling */
        }
      };
      void tick();
      poll = setInterval(tick, 3000);
    };

    es.addEventListener("scan", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setState((s) => ({ ...s, mock: !!d.mock }));
    });
    es.addEventListener("pending", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setState((s) => (s.rows.some((r) => r.key === d.key) ? s : { ...s, rows: [...s.rows, { ...d, status: "pending", verdict: "unknown", maliciousCount: null, totalCount: null, summary: {}, reportUrl: null, error: null }] }));
    });
    es.addEventListener("result", (e) => upsert(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("subdomains", (e) => setState((s) => ({ ...s, subdomains: JSON.parse((e as MessageEvent).data) })));
    es.addEventListener("score", (e) => applyScore(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("done", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      finished = true;
      setState((s) => ({ ...s, status: d.status === "timeout" ? "timeout" : (d.status ?? "done") }));
      es?.close();
    });
    es.onopen = () => { errors = 0; setReconnecting(false); };
    es.onerror = () => {
      if (finished) return;
      errors += 1;
      setReconnecting(true);
      if (errors >= 3) { setReconnecting(false); startPolling(); }
    };

    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, [scanId, token]);

  return <IntelPanel state={state} reconnecting={reconnecting} />;
}
