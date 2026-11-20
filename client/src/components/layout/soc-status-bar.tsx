import { Activity, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

/** Thin bottom bar for ingestion health and last sync (SPEC 3). Wired to data in phase 3. */
export function SocStatusBar() {
  const t = useTranslations("soc.status");
  return (
    <div className="flex items-center gap-4" role="status">
      <span className="inline-flex items-center gap-1.5">
        <Activity className="size-3.5" aria-hidden="true" />
        {t("ingestion")}: <span className="text-foreground">{t("unknown")}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <RefreshCw className="size-3.5" aria-hidden="true" />
        {t("lastSync")}: <span className="text-foreground">{t("unknown")}</span>
      </span>
    </div>
  );
}
