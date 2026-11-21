"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Printer } from "lucide-react";
import { logGeoExport } from "@/app/[locale]/soc/geo/actions";
import { Button } from "@/components/ui/button";
import type { GeoData } from "@/server/geo/stats";
import { GeoMap, type CellValue } from "./GeoMap";
import { Legend } from "./Legend";
import { makeScale } from "./scales";

export function BriefingMap({ metrics, hot, title }: { metrics: GeoData["metrics"]; hot: GeoData["hot"]; title: string }) {
  const t = useTranslations("geo");
  const { cells, scale } = useMemo(() => {
    const sc = makeScale("count", metrics.map((m) => m.observed));
    return {
      scale: sc,
      cells: new Map<string, CellValue>(metrics.map((m) => [m.code, { value: m.observed, count: m.observed, lowData: m.observed > 0 && m.observed < 3, label: `${m.name} ${m.observed}`, tip: { name: m.name, county: m.county, count: String(m.observed) } }])),
    };
  }, [metrics]);
  return (
    <div className="space-y-2">
      <GeoMap kind="map" compact cells={cells} scale={scale} zones={hot.filter((h) => h.severity !== "watch").map((h) => ({ code: h.code, members: h.members, severity: h.severity }))} ariaLabel={title} className="[&_svg]:max-h-[150mm]" />
      <Legend scale={scale} title={t("metrics.count")} />
    </div>
  );
}

export function PrintButton({ query }: { query: string }) {
  const t = useTranslations("geo.export");
  useEffect(() => { void logGeoExport({ kind: "print", query }); }, [query]);
  return <Button type="button" className="geo-noprint" onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" />{t("print")}</Button>;
}
