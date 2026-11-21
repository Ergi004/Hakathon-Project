"use client";

import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Severity } from "@/server/geo/hotspots";
import { cn } from "@/lib/utils";
import { COUNTRY_OUTLINE, COUNTY_BORDERS, HEX_RADIUS, HEX_SHAPES, MUNI_SHAPES, VIEW, zoneOutline, type Shape } from "./geometry";
import type { ColorScale } from "./scales";

export interface CellValue {
  value: number | null;      // metric value used for colour
  count: number;             // reports in view
  lowData: boolean;          // 1–2 reports: never highlighted
  label: string;             // accessible label
  tip: { name: string; county: string; count: string; rate?: string; change?: string; top?: string };
}

export interface MapZone { code: string; members: string[]; severity: Severity }

export interface GeoMapHandle { svg: SVGSVGElement | null; reset: () => void }

interface Props {
  kind: "map" | "hex";
  cells: Map<string, CellValue>;
  scale: ColorScale;
  showCounties?: boolean;
  showZones?: boolean;
  showBubbles?: boolean;
  zones?: MapZone[];
  selected?: string | null;
  onSelect?: (code: string) => void;
  focusCode?: string | null;
  pulse?: Set<string>;
  markers?: string[];
  compact?: boolean;
  ariaLabel: string;
  className?: string;
}

const DIRS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

/** Nearest shape in the arrow's direction (within ±60°), for keyboard navigation between regions. */
function nextInDirection(shapes: Shape[], from: Shape, dir: [number, number]): Shape | null {
  let best: Shape | null = null, bestScore = Infinity;
  for (const s of shapes) {
    if (s.code === from.code) continue;
    const dx = s.cx - from.cx, dy = s.cy - from.cy;
    const dist = Math.hypot(dx, dy);
    const cos = (dx * dir[0] + dy * dir[1]) / (dist || 1);
    if (cos < 0.5) continue;
    const score = dist * (2 - cos);
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export const GeoMap = forwardRef<GeoMapHandle, Props>(function GeoMap(
  { kind, cells, scale, showCounties = true, showZones = true, showBubbles = false, zones = [], selected, onSelect, focusCode, pulse, markers = [], compact = false, ariaLabel, className },
  ref,
) {
  const t = useTranslations("geo.map");
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [tip, setTip] = useState<{ code: string; x: number; y: number } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const shapes = kind === "hex" ? HEX_SHAPES : MUNI_SHAPES;
  const byCode = useMemo(() => new Map(shapes.map((s) => [s.code, s])), [shapes]);

  useImperativeHandle(ref, () => ({ svg: svgRef.current, reset: () => zoomTo(zoomIdentity) }));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || compact) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([[-40, -40], [VIEW.w + 40, VIEW.h + 40]])
      // Wheel zooms only with Ctrl/⌘ so the page still scrolls; drag and pinch always pan/zoom.
      .filter((e: Event) => (e.type === "wheel" ? (e as WheelEvent).ctrlKey || (e as WheelEvent).metaKey : !(e as MouseEvent).button))
      .on("zoom", (e) => setTransform(e.transform));
    zoomRef.current = z;
    select(svg).call(z);
    return () => { select(svg).on(".zoom", null); };
  }, [compact]);

  function zoomTo(tr: ZoomTransform) {
    if (svgRef.current && zoomRef.current) zoomRef.current.transform(select(svgRef.current), tr);
  }
  const zoomBy = (k: number) => { if (svgRef.current && zoomRef.current) zoomRef.current.scaleBy(select(svgRef.current), k); };

  // Focus a region requested from outside (hot-zone list click).
  useEffect(() => {
    if (!focusCode || compact) return;
    const s = byCode.get(focusCode);
    if (!s) return;
    const k = kind === "hex" ? 2.2 : 3;
    zoomTo(zoomIdentity.translate(VIEW.w / 2 - s.cx * k, VIEW.h / 2 - s.cy * k).scale(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCode, kind]);

  const fillFor = (code: string) => {
    const c = cells.get(code);
    if (!c || c.count === 0) return `url(#nodata-${uid})`;
    if (c.lowData) return `url(#lowdata-${uid})`;
    if (c.value === null || !Number.isFinite(c.value)) return "var(--geo-mid)";
    return scale.color(c.value);
  };

  const zonePaths = useMemo(() => (showZones && kind === "map" ? zones.map((z) => ({ ...z, d: zoneOutline(z.members) })) : []), [zones, showZones, kind]);
  const zoneMember = useMemo(() => new Map(zones.flatMap((z) => z.members.map((m) => [m, z.severity] as const))), [zones]);
  const maxCount = Math.max(1, ...[...cells.values()].map((c) => c.count));
  const tabStop = focused ?? selected ?? shapes.slice().sort((a, b) => a.cy - b.cy)[0]?.code;

  function onKey(e: React.KeyboardEvent, s: Shape) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(s.code); return; }
    const dir = DIRS[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = nextInDirection(shapes, s, dir);
    if (next) {
      setFocused(next.code);
      (svgRef.current?.querySelector(`[data-code="${next.code}"]`) as SVGPathElement | null)?.focus();
    }
  }

  function showTip(code: string, evt?: React.MouseEvent) {
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    if (evt) setTip({ code, x: evt.clientX - wrap.left, y: evt.clientY - wrap.top });
    else {
      const s = byCode.get(code)!;
      const svgBox = svgRef.current!.getBoundingClientRect();
      const k = svgBox.width / VIEW.w;
      setTip({ code, x: (transform.applyX(s.cx)) * k + (svgBox.left - wrap.left), y: (transform.applyY(s.cy)) * k + (svgBox.top - wrap.top) });
    }
  }

  const tipCell = tip ? cells.get(tip.code) : null;
  const sw = 0.6 / transform.k;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        role="group"
        aria-label={ariaLabel}
        className={cn("h-auto w-full touch-none select-none", compact ? "max-h-64" : "max-h-[72vh]")}
        onKeyDown={(e) => {
          if (compact) return;
          if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.4); }
          else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.4); }
          else if (e.key === "0") { e.preventDefault(); zoomTo(zoomIdentity); }
          else if (e.key === "Escape") setTip(null);
        }}
        onMouseLeave={() => setTip(null)}
      >
        <defs>
          <pattern id={`nodata-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--geo-nodata)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeOpacity="0.35" strokeWidth="1.2" />
          </pattern>
          <pattern id={`lowdata-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="var(--geo-0)" />
            <circle cx="2.5" cy="2.5" r="0.9" fill="var(--muted-foreground)" fillOpacity="0.55" />
          </pattern>
        </defs>
        <rect width={VIEW.w} height={VIEW.h} fill="transparent" />
        <g transform={transform.toString()}>
          {shapes.map((s) => {
            const c = cells.get(s.code);
            const isSel = selected === s.code;
            return (
              <path
                key={s.code}
                data-code={s.code}
                d={s.d}
                fill={fillFor(s.code)}
                stroke={isSel ? "var(--foreground)" : "var(--geo-stroke)"}
                strokeWidth={isSel ? 2.2 / transform.k : kind === "hex" ? 1 / transform.k : sw}
                tabIndex={compact ? -1 : s.code === tabStop ? 0 : -1}
                role={compact ? undefined : "button"}
                aria-label={c?.label ?? s.code}
                aria-pressed={compact ? undefined : isSel}
                className={cn("outline-none transition-[fill] duration-300 focus-visible:stroke-[var(--ring)] motion-reduce:transition-none", !compact && "cursor-pointer hover:brightness-110")}
                style={{ strokeLinejoin: "round" }}
                onClick={() => onSelect?.(s.code)}
                onMouseMove={(e) => !compact && showTip(s.code, e)}
                onFocus={() => { setFocused(s.code); showTip(s.code); }}
                onBlur={() => setTip(null)}
                onKeyDown={(e) => onKey(e, s)}
              />
            );
          })}
          {kind === "hex" && (
            <g aria-hidden="true" pointerEvents="none">
              {shapes.map((s) => (
                <text key={s.code} x={s.cx} y={s.cy + 2.5} textAnchor="middle" fontSize={Math.max(5, HEX_RADIUS * 0.32)} className="fill-foreground/80 font-medium">
                  {(cells.get(s.code)?.tip.name ?? s.code).slice(0, 7)}
                </text>
              ))}
            </g>
          )}
          {kind === "map" && <path d={COUNTRY_OUTLINE} fill="none" stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth={1 / transform.k} pointerEvents="none" />}
          {showCounties && kind === "map" && <path d={COUNTY_BORDERS} fill="none" stroke="var(--foreground)" strokeOpacity="0.7" strokeWidth={1.4 / transform.k} pointerEvents="none" />}
          {showBubbles && (
            <g pointerEvents="none" aria-hidden="true">
              {shapes.map((s) => {
                const c = cells.get(s.code);
                if (!c || c.count < 3) return null;
                const r = (Math.sqrt(c.count / maxCount) * (kind === "hex" ? HEX_RADIUS * 0.85 : 22)) / Math.sqrt(transform.k);
                return <circle key={s.code} cx={s.cx} cy={s.cy} r={r} fill="var(--geo-5)" fillOpacity="0.45" stroke="var(--geo-6)" strokeWidth={1 / transform.k} />;
              })}
            </g>
          )}
          {showZones && (
            <g pointerEvents="none" aria-hidden="true">
              {kind === "map"
                ? zonePaths.map((z) => (
                    <path key={z.code} d={z.d} fill="none" stroke={z.severity === "critical" ? "var(--flag-darkred)" : "var(--flag-red)"} strokeWidth={2.5 / transform.k} strokeDasharray={z.severity === "critical" ? undefined : `${4 / transform.k} ${3 / transform.k}`} className={z.severity === "critical" ? "geo-pulse" : undefined} />
                  ))
                : shapes.filter((s) => zoneMember.has(s.code)).map((s) => (
                    <path key={s.code} d={s.d} fill="none" stroke={zoneMember.get(s.code) === "critical" ? "var(--flag-darkred)" : "var(--flag-red)"} strokeWidth={2.5 / transform.k} className={zoneMember.get(s.code) === "critical" ? "geo-pulse" : undefined} />
                  ))}
            </g>
          )}
          {pulse && pulse.size > 0 && (
            <g pointerEvents="none" aria-hidden="true">
              {shapes.filter((s) => pulse.has(s.code)).map((s) => <path key={`${s.code}-${pulse.size}`} d={s.d} fill="var(--geo-4)" className="geo-flash" />)}
            </g>
          )}
          {markers.length > 0 && (
            <g pointerEvents="none">
              {markers.map((code) => {
                const s = byCode.get(code);
                if (!s) return null;
                const r = 7 / transform.k;
                return (
                  <g key={code}>
                    <path d={`M${s.cx},${s.cy - r}L${s.cx + r},${s.cy}L${s.cx},${s.cy + r}L${s.cx - r},${s.cy}Z`} fill="var(--primary)" stroke="var(--background)" strokeWidth={1.5 / transform.k} />
                    <title>{t("imitatedMarker")}</title>
                  </g>
                );
              })}
            </g>
          )}
        </g>
      </svg>

      {!compact && (
        <div className="geo-noprint absolute top-2 right-2 flex flex-col gap-1" role="toolbar" aria-label={t("zoomControls")}>
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={() => zoomBy(1.4)} aria-label={t("zoomIn")}><Plus className="size-4" aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={() => zoomBy(1 / 1.4)} aria-label={t("zoomOut")}><Minus className="size-4" aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={() => zoomTo(zoomIdentity)} aria-label={t("zoomReset")}><Maximize2 className="size-4" aria-hidden="true" /></Button>
        </div>
      )}

      {tip && tipCell && (
        <div role="tooltip" className="pointer-events-none absolute z-20 min-w-44 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg" style={{ left: tip.x, top: tip.y }}>
          <p className="font-medium">{tipCell.tip.name}</p>
          <p className="text-muted-foreground">{tipCell.tip.county}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-muted-foreground">{t("count")}</dt><dd className="text-right font-mono">{tipCell.tip.count}</dd>
            {tipCell.tip.rate && (<><dt className="text-muted-foreground">{t("rate")}</dt><dd className="text-right font-mono">{tipCell.tip.rate}</dd></>)}
            {tipCell.tip.change && (<><dt className="text-muted-foreground">{t("change")}</dt><dd className="text-right font-mono">{tipCell.tip.change}</dd></>)}
            {tipCell.tip.top && (<><dt className="text-muted-foreground">{t("topInstitution")}</dt><dd className="max-w-40 truncate text-right">{tipCell.tip.top}</dd></>)}
          </dl>
          {tipCell.lowData && <p className="mt-1 text-muted-foreground">{t("lowData")}</p>}
        </div>
      )}
    </div>
  );
});

/** Hexagon tile map: one equal-size hexagon per municipality, same colours and interactions. */
export const HexMap = forwardRef<GeoMapHandle, Omit<Props, "kind">>(function HexMap(props, ref) {
  return <GeoMap ref={ref} kind="hex" {...props} />;
});
