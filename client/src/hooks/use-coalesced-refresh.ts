"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * `router.refresh()` re-renders the whole route on the server (layout + page + every query).
 * Realtime events can arrive in bursts, so calls are coalesced: at most one refresh per
 * `minIntervalMs`, none while the tab is hidden (one runs when it becomes visible again),
 * and a window focus only refreshes when the last refresh is older than `focusStaleMs`.
 */
export function useCoalescedRefresh({ minIntervalMs = 3000, focusStaleMs = 30_000 }: { minIntervalMs?: number; focusStaleMs?: number } = {}) {
  const router = useRouter();
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const missed = useRef(false);

  const refresh = useMemo(() => {
    const run = () => {
      timer.current = null;
      if (document.visibilityState === "hidden") {
        missed.current = true;
        return;
      }
      missed.current = false;
      last.current = Date.now();
      router.refresh();
    };
    return () => {
      if (timer.current) return;
      const wait = Math.max(0, last.current + minIntervalMs - Date.now());
      timer.current = setTimeout(run, wait);
    };
  }, [router, minIntervalMs]);

  useEffect(() => {
    // The page was just rendered, so it starts fresh.
    if (!last.current) last.current = Date.now();
    const onFocus = () => {
      if (Date.now() - last.current > focusStaleMs) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && missed.current) refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [refresh, focusStaleMs]);

  return refresh;
}
