"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";
import { MUNICIPALITIES, regionName } from "@/lib/geo/regions";
import { GeoMap, type CellValue } from "./GeoMap";
import { makeScale } from "./scales";

/** Small locator map: the region highlighted, neighbours lightly shaded. Optional counts per region. */
export function RegionMiniMap({ code, label, counts, markers }: { code?: string; label: string; counts?: Record<string, number>; markers?: string[] }) {
  const locale = useLocale();
  const { cells, scale } = useMemo(() => {
    const neighbours = new Set(MUNICIPALITIES.find((m) => m.code === code)?.neighbors ?? []);
    const vals = counts ? Object.values(counts) : [2, 1];
    const sc = makeScale("count", vals);
    const map = new Map<string, CellValue>();
    for (const m of MUNICIPALITIES) {
      const n = counts ? counts[m.code] ?? 0 : m.code === code ? 2 : neighbours.has(m.code) ? 1 : 0;
      map.set(m.code, { value: n, count: counts ? n : n ? 3 : 0, lowData: counts ? n > 0 && n < 3 : false, label: regionName(m.code, locale), tip: { name: regionName(m.code, locale), county: "", count: String(n) } });
    }
    return { cells: map, scale: sc };
  }, [code, counts, locale]);
  return <GeoMap kind="map" compact cells={cells} scale={scale} selected={code ?? null} markers={markers} ariaLabel={label} showZones={false} />;
}
