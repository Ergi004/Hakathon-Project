"use client";

import { Activity, Command, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fmtAgo } from "@/lib/format";

/**
 * Thin bottom bar: ingestion health and last sync (SPEC 3).
 * Time-relative values are computed in the browser after mount (and every minute): reading the
 * clock during the server render breaks prerendering with cacheComponents (blocking-prerender-current-time).
 */
export function SocStatusBar({ lastSync }: { lastSync: string | null }) {
  const t = useTranslations("soc.status");
  const locale = useLocale();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  const healthy = now !== null && !!lastSync && now - Date.parse(lastSync) < 6 * 3_600_000;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="status">
      <span className="inline-flex items-center gap-1.5">
        <Activity className="size-3.5" aria-hidden="true" />
        {t("ingestion")}:
        <span className="inline-flex items-center gap-1 text-foreground">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${healthy ? "bg-flag-green" : "bg-flag-grey"}`} />
          {now === null ? "…" : healthy ? "OK" : t("unknown")}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {t("lastSync")}: <span className="text-foreground">{!lastSync ? t("unknown") : now === null ? "…" : fmtAgo(lastSync, locale)}</span>
      </span>
      <span className="ml-auto hidden items-center gap-1 sm:inline-flex"><Command className="size-3" aria-hidden="true" />K</span>
    </div>
  );
}
