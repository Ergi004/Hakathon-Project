import { Activity, Command, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { fmtAgo } from "@/lib/format";
import { nowMs } from "@/lib/time";

/** Thin bottom bar: ingestion health and last sync (SPEC 3). */
export function SocStatusBar({ lastSync }: { lastSync: string | null }) {
  const t = useTranslations("soc.status");
  const locale = useLocale();
  const healthy = !!lastSync && nowMs() - Date.parse(lastSync) < 6 * 3_600_000;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" role="status">
      <span className="inline-flex items-center gap-1.5">
        <Activity className="size-3.5" aria-hidden="true" />
        {t("ingestion")}:
        <span className="inline-flex items-center gap-1 text-foreground">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${healthy ? "bg-flag-green" : "bg-flag-grey"}`} />
          {healthy ? "OK" : t("unknown")}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {t("lastSync")}: <span className="text-foreground">{lastSync ? fmtAgo(lastSync, locale) : t("unknown")}</span>
      </span>
      <span className="ml-auto hidden items-center gap-1 sm:inline-flex"><Command className="size-3" aria-hidden="true" />K</span>
    </div>
  );
}
