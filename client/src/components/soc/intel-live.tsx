"use client";

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/server/supabase/client";

type ScanRow = { id: string; channel: string; status: string; verdict: string; albania: boolean; vt_max_malicious: number | null };

/**
 * Live updates for /soc/intel (Supabase Realtime on phishing_scans; RLS applies).
 * List mode: toast on new and finished scans. Detail mode (scanId): refresh while it runs.
 * Refreshes are debounced because every pipeline stage updates the row.
 */
export function IntelLive({ scanId, albaniaOnly = false }: { scanId?: string; albaniaOnly?: boolean }) {
  const t = useTranslations("soc.intel.live");
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserClient> | null = null;
    try {
      supabase = createBrowserClient();
    } catch {
      return;
    }
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 800);
    };
    const filter = scanId ? `id=eq.${scanId}` : undefined;
    const channel = supabase
      .channel(scanId ? `intel-${scanId}` : "intel-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "phishing_scans", ...(filter ? { filter } : {}) }, (payload) => {
        const row = payload.new as Partial<ScanRow>;
        if (!scanId && albaniaOnly && row.albania === false) return;
        if (!scanId && payload.eventType === "INSERT") {
          toast(t("newScan", { channel: (row.channel ?? "").toUpperCase() }), { action: { label: "→", onClick: () => router.push(`/soc/intel/${row.id}`) } });
        }
        const old = payload.old as Partial<ScanRow>;
        const finished = payload.eventType === "UPDATE" && (row.status === "completed" || row.status === "partial") && old.status !== row.status;
        if (!scanId && finished && (row.verdict === "malicious" || (row.vt_max_malicious ?? 0) > 0)) {
          toast.warning(t("maliciousScan", { channel: (row.channel ?? "").toUpperCase(), engines: row.vt_max_malicious ?? 0 }), {
            action: { label: "→", onClick: () => router.push(`/soc/intel/${row.id}`) },
          });
        }
        refresh();
      });
    // Detail page: landing-page sandbox results arrive on their own table.
    if (scanId) channel.on("postgres_changes", { event: "*", schema: "public", table: "landing_analyses", filter: `scan_id=eq.${scanId}` }, () => refresh());
    channel
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase?.removeChannel(channel);
    };
  }, [router, t, scanId, albaniaOnly]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      <Radio className={`size-3.5 ${connected ? "text-flag-green" : ""}`} aria-hidden="true" />
      {connected ? t("on") : t("off")}
    </span>
  );
}
