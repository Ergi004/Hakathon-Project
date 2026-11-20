"use client";

import { FlaskConical, Map as MapIcon, Table2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePathname, useRouter } from "@/i18n/navigation";
import { filtersToQuery, LAYERS, type GeoFilters } from "@/lib/geo/filters";
import type { GeoData, RegionMetric } from "@/server/geo/stats";
import { ExportMenu } from "./ExportMenu";
import { FilterBar } from "./FilterBar";
import { GeoMap, type CellValue, type GeoMapHandle, type MapZone } from "./GeoMap";
import { GeoRealtime } from "./GeoRealtime";
import { HotZoneList } from "./HotZoneList";
import { Legend } from "./Legend";
import { MapTable } from "./MapTable";
import { RegionDrawer } from "./RegionDrawer";
import { differenceScale, makeScale, type ColorScale, type Metric } from "./scales";
import { TimePlayer } from "./TimePlayer";

type Layer = (typeof LAYERS)[number];

export function GeoExplorer({ data, filters, idToCode }: { data: GeoData; filters: GeoFilters; idToCode: Record<string, string> }) {
  const t = useTranslations("geo");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const mapRef = useRef<GeoMapHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [pulse, setPulse] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const query = filtersToQuery(filters);
  const metric: Metric = filters.metric === "rate" && !data.hasPopulation ? "count" : filters.metric;
  const layers = new Set<Layer>(filters.layers);
  const base: "map" | "hex" = layers.has("hex") ? "hex" : "map";
  const playing = dayIndex !== null;

  const setUrl = (patch: Partial<GeoFilters>) => {
    const q = filtersToQuery({ ...filters, ...patch });
    start(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false }));
  };

  const periodLabel = t(`filters.ranges.${filters.range}`);
  const fmtChange = (m: RegionMetric) => (m.change === null ? undefined : `${m.change > 0 ? "+" : ""}${Math.round(m.change * 100)}%`);

  // Cell values for the selected metric (or for one day while the time player is used).
  const { cells, scale } = useMemo(() => {
    const value = (m: RegionMetric): number | null => {
      if (playing) return m.daily[dayIndex!];
      if (metric === "rate") return m.rate;
      if (metric === "change") return m.change;
      if (metric === "z") return m.lowData ? null : m.z;
      return m.observed;
    };
    const vals = data.metrics.map(value).filter((v): v is number => v !== null);
    const sc = makeScale(playing ? "count" : metric, vals);
    const map = new Map<string, CellValue>();
    for (const m of data.metrics) {
      const count = playing ? m.daily[dayIndex!] : m.observed;
      const change = fmtChange(m);
      map.set(m.code, {
        value: value(m),
        count,
        lowData: count > 0 && count < 3,
        label: t("map.aria", { name: m.name, count, period: playing ? data.window.days[dayIndex!] : periodLabel }) + (change && !playing ? `, ${t("map.ariaChange", { change })}` : "") + (count > 0 && count < 3 ? `, ${t("map.lowData")}` : ""),
        tip: { name: m.name, county: m.county, count: String(count), rate: m.rate !== null ? m.rate.toFixed(1) : undefined, change, top: m.topInstitution ?? undefined },
      });
    }
    return { cells: map, scale: sc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric, dayIndex, playing, locale]);

  const zones: MapZone[] = useMemo(() => data.hot.filter((h) => h.severity !== "watch").map((h) => ({ code: h.code, members: h.members, severity: h.severity })), [data.hot]);

  // Compare mode: previous period and the difference, same colours / diverging scale.
  const compare = useMemo(() => {
    if (!filters.compare) return null;
    const prevCells = new Map<string, CellValue>();
    const diffCells = new Map<string, CellValue>();
    const diffs = data.metrics.map((m) => m.observed - m.prev);
    for (const m of data.metrics) {
      const d = m.observed - m.prev;
      prevCells.set(m.code, { value: m.prev, count: m.prev, lowData: m.prev > 0 && m.prev < 3, label: t("map.aria", { name: m.name, count: m.prev, period: t("compare.previous") }), tip: { name: m.name, county: m.county, count: String(m.prev) } });
      diffCells.set(m.code, { value: d, count: Math.max(m.observed, m.prev), lowData: false, label: t("compare.diffAria", { name: m.name, diff: `${d > 0 ? "+" : ""}${d}` }), tip: { name: m.name, county: m.county, count: `${m.prev} → ${m.observed}`, change: `${d > 0 ? "+" : ""}${d}` } });
    }
    const prevScale: ColorScale = makeScale("count", [...data.metrics.map((m) => m.observed), ...data.metrics.map((m) => m.prev)]);
    return { prevCells, diffCells, prevScale, diffScale: differenceScale(diffs) };
  }, [filters.compare, data.metrics, t]);

  const select = useCallback((code: string) => { setSelected(code); }, []);
  const onPulse = useCallback((codes: string[]) => {
    setPulse(new Set(codes));
    setRefreshKey((k) => k + 1);
    setTimeout(() => setPulse(new Set()), 1800);
  }, []);

  const metricTitle = playing ? t("metrics.count") : t(`metrics.${metric}`);
  const mapTitle = `${t(`filters.modes.${filters.mode}`)} · ${metricTitle} · ${periodLabel}`;
  const commonMapProps = { showCounties: layers.has("counties"), showZones: layers.has("zones"), showBubbles: layers.has("bubbles"), zones, selected, onSelect: select, pulse };

  return (
    <div className="space-y-4">
      <GeoRealtime idToCode={idToCode} locale={locale} onPulse={onPulse} />
      <FilterBar filters={filters} options={data.options} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup type="multiple" variant="outline" size="sm" value={[...layers]} aria-label={t("layers.label")}
              onValueChange={(v) => {
                let next = v as Layer[];
                const added = next.find((x) => !layers.has(x));
                if (added === "hex") next = next.filter((x) => x !== "municipalities");
                if (added === "municipalities") next = next.filter((x) => x !== "hex");
                if (!next.includes("hex") && !next.includes("municipalities")) next = ["municipalities", ...next];
                setUrl({ layers: next });
              }}>
              {LAYERS.map((l) => <ToggleGroupItem key={l} value={l} aria-label={t(`layers.${l}`)} className="px-2.5 text-xs">{t(`layers.${l}`)}</ToggleGroupItem>)}
            </ToggleGroup>
            <ToggleGroup type="single" variant="outline" size="sm" value={metric} aria-label={t("metrics.label")} onValueChange={(v) => v && setUrl({ metric: v as Metric })}>
              {(["count", "rate", "change", "z"] as const).map((m) =>
                m === "rate" && !data.hasPopulation ? (
                  <Tooltip key={m}>
                    <TooltipTrigger asChild><span tabIndex={0}><ToggleGroupItem value={m} disabled className="px-2.5 text-xs">{t("metrics.rate")}</ToggleGroupItem></span></TooltipTrigger>
                    <TooltipContent className="max-w-64">{t("metrics.rateDisabled")}</TooltipContent>
                  </Tooltip>
                ) : <ToggleGroupItem key={m} value={m} className="px-2.5 text-xs">{t(`metrics.${m}`)}</ToggleGroupItem>,
              )}
            </ToggleGroup>
            <div className="ml-auto flex items-center gap-2">
              {data.demo && <Badge variant="secondary" className="gap-1"><FlaskConical className="size-3.5" aria-hidden="true" />{t("demo")}</Badge>}
              <ToggleGroup type="single" variant="outline" size="sm" value={filters.view} aria-label={t("view.label")} onValueChange={(v) => v && setUrl({ view: v as "map" | "table" })}>
                <ToggleGroupItem value="map" className="px-2.5 text-xs"><MapIcon className="size-3.5" aria-hidden="true" />{t("view.map")}</ToggleGroupItem>
                <ToggleGroupItem value="table" className="px-2.5 text-xs"><Table2 className="size-3.5" aria-hidden="true" />{t("view.table")}</ToggleGroupItem>
              </ToggleGroup>
              <ExportMenu mapRef={mapRef} query={query} title={`Mburoja · ${mapTitle}`} />
            </div>
          </div>

          {filters.view === "table" ? (
            <MapTable rows={data.metrics} onSelect={select} hasPopulation={data.hasPopulation} />
          ) : compare ? (
            <div className="grid gap-3 md:grid-cols-3">
              <figure className="glass-card rounded-xl p-2"><figcaption className="px-1 pb-1 text-sm font-medium">{t("compare.current")} · {data.total}</figcaption><GeoMap ref={mapRef} kind={base} cells={cells} scale={compare.prevScale} ariaLabel={t("compare.current")} {...commonMapProps} /></figure>
              <figure className="glass-card rounded-xl p-2"><figcaption className="px-1 pb-1 text-sm font-medium">{t("compare.previous")} · {data.prevTotal}</figcaption><GeoMap kind={base} cells={compare.prevCells} scale={compare.prevScale} ariaLabel={t("compare.previous")} {...commonMapProps} showZones={false} /></figure>
              <figure className="glass-card rounded-xl p-2"><figcaption className="px-1 pb-1 text-sm font-medium">{t("compare.difference")}</figcaption><GeoMap kind={base} cells={compare.diffCells} scale={compare.diffScale} ariaLabel={t("compare.difference")} {...commonMapProps} showZones={false} /></figure>
              <div className="md:col-span-2"><Legend scale={compare.prevScale} title={t("legend.count")} /></div>
              <Legend scale={compare.diffScale} title={t("legend.difference")} />
            </div>
          ) : (
            <div className="glass-card space-y-3 rounded-xl p-3">
              <p className="text-sm font-medium">{mapTitle}{playing && <span className="ml-2 text-xs text-muted-foreground">{t("player.dayNote")}</span>}</p>
              <GeoMap ref={mapRef} kind={base} cells={cells} scale={scale} focusCode={focusCode} ariaLabel={t("map.label", { title: mapTitle })} {...commonMapProps} />
              <Legend scale={scale} title={metricTitle} />
              <p className="text-xs text-muted-foreground">{t("map.keyboardHint")}</p>
            </div>
          )}

          {filters.view === "map" && <TimePlayer days={data.window.days} totals={data.dailyTotals} index={dayIndex} onChange={setDayIndex} />}
        </div>

        <aside className="min-w-0">
          <HotZoneList hot={data.hot} onFocus={(c) => { setFocusCode(c); setSelected(c); }} source={data.hotSource} computedAt={data.computedAt} unknown={data.unknown} total={data.total} mode={filters.mode} />
        </aside>
      </div>

      <RegionDrawer code={selected} query={query} mode={filters.mode} refreshKey={refreshKey} onClose={() => setSelected(null)} />
    </div>
  );
}
