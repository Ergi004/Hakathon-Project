"use client";

import { AlertCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { loadRegionDetail } from "@/app/[locale]/soc/geo/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { regionName } from "@/lib/geo/regions";
import type { RegionDetail } from "@/server/geo/stats";
import { RegionDetailView } from "./RegionDetailView";

/** Region drawer (shadcn Sheet). Loads the drill-down through a staff-only server action. */
export function RegionDrawer({ code, query, mode, refreshKey, onClose }: { code: string | null; query: string; mode: "victim" | "imitated"; refreshKey: number; onClose: () => void }) {
  const t = useTranslations("geo.region");
  const locale = useLocale();
  const [state, setState] = useState<{ code: string; detail: RegionDetail | null; error: boolean } | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    loadRegionDetail({ code, query, locale }).then((r) => {
      if (alive) setState({ code, detail: r.ok ? r.data : null, error: !r.ok });
    });
    return () => { alive = false; };
  }, [code, query, locale, refreshKey]);

  const current = state && state.code === code ? state : null;
  return (
    <Sheet open={!!code} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{code ? regionName(code, locale) : ""}</SheetTitle>
          <SheetDescription>{mode === "victim" ? t("modeVictim") : t("modeImitated")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {!current && (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-16 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
            </div>
          )}
          {current?.error && <Alert variant="destructive"><AlertCircle className="size-4" aria-hidden="true" /><AlertDescription>{t("loadError")}</AlertDescription></Alert>}
          {current?.detail && <RegionDetailView d={current.detail} query={query} mode={mode} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
