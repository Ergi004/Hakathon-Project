"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { regionName } from "@/lib/geo/regions";
import { createBrowserClient } from "@/server/supabase/client";

/**
 * Staff-only live updates (RLS limits both tables to staff): new reports and new hot spots.
 * Debounced 2 s → pulse the affected regions, refresh the server data, toast new critical zones.
 * Fallback: refetch when the window regains focus.
 */
export function GeoRealtime({ idToCode, locale, onPulse }: { idToCode: Record<string, string>; locale: string; onPulse: (codes: string[]) => void }) {
  const t = useTranslations("geo.live");
  const router = useRouter();
  const pending = useRef({ codes: new Set<string>(), critical: new Set<string>() });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenCritical = useRef(new Set<string>());
  const onPulseRef = useRef(onPulse);
  useEffect(() => { onPulseRef.current = onPulse; }, [onPulse]);

  useEffect(() => {
    let client: ReturnType<typeof createBrowserClient> | null = null;
    try { client = createBrowserClient(); } catch { client = null; }

    const flush = () => {
      timer.current = null;
      const { codes, critical } = pending.current;
      pending.current = { codes: new Set(), critical: new Set() };
      if (codes.size) onPulseRef.current([...codes]);
      for (const c of critical) {
        if (seenCritical.current.has(c)) continue;
        seenCritical.current.add(c);
        toast.error(t("critical", { name: regionName(c, locale) }), { action: { label: t("open"), onClick: () => router.push(`/soc/geo/${c}`) } });
      }
      router.refresh();
    };
    const schedule = () => { if (!timer.current) timer.current = setTimeout(flush, 2000); };

    const ch = client?.channel("geo-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (p) => {
        const code = idToCode[(p.new as { region_id?: string | null }).region_id ?? ""];
        if (code) pending.current.codes.add(code);
        schedule();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports" }, (p) => {
        const code = idToCode[(p.new as { region_id?: string | null }).region_id ?? ""];
        if (code) { pending.current.codes.add(code); schedule(); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "geo_hotspots" }, (p) => {
        const row = p.new as { region_id: string; severity: string };
        const code = idToCode[row.region_id];
        if (code && row.severity === "critical") pending.current.critical.add(code);
        schedule();
      })
      .subscribe();

    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer.current) clearTimeout(timer.current);
      if (ch) client?.removeChannel(ch);
    };
  }, [idToCode, locale, router, t]);

  return null;
}
