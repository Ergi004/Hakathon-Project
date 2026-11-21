"use client";

import { Download, FileJson, FileSpreadsheet, ImageDown, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { toast } from "sonner";
import { logGeoExport } from "@/app/[locale]/soc/geo/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { GeoMapHandle } from "./GeoMap";

/** Inline computed colours so the PNG renders without the page's CSS variables. */
function inlineStyles(source: SVGSVGElement): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const src = [source, ...source.querySelectorAll("*")];
  const dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const d = dst[i] as SVGElement;
    for (const prop of ["fill", "stroke", "stroke-width", "stroke-opacity", "fill-opacity", "opacity", "font-size", "font-family", "font-weight"]) {
      const v = cs.getPropertyValue(prop);
      if (v) d.style.setProperty(prop, v);
    }
    d.removeAttribute("class");
  });
  return clone;
}

async function svgToPng(svg: SVGSVGElement, title: string): Promise<Blob> {
  const box = svg.viewBox.baseVal;
  const scale = 2.5;
  const clone = inlineStyles(svg);
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = box.width * scale;
    canvas.height = (box.height + 30) * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.body).color || "#000";
    ctx.font = `${11 * scale}px system-ui, sans-serif`;
    ctx.fillText(title, 8 * scale, 18 * scale);
    ctx.drawImage(img, 0, 30 * scale, box.width * scale, box.height * scale);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Exports: aggregates only, every one audited. */
export function ExportMenu({ mapRef, query, title }: { mapRef: RefObject<GeoMapHandle | null>; query: string; title: string }) {
  const t = useTranslations("geo.export");
  const tu = useTranslations("ui");
  const png = async () => {
    const svg = mapRef.current?.svg;
    if (!svg) return;
    try {
      const blob = await svgToPng(svg, title);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mburoja-geo-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      await logGeoExport({ kind: "png", query });
    } catch {
      toast.error(tu("errorGeneric"));
    }
  };
  const api = (format: "csv" | "geojson") => `/api/soc/geo/export?format=${format}${query ? `&${query}` : ""}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline"><Download className="size-4" aria-hidden="true" />{t("label")}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void png()}><ImageDown className="size-4" aria-hidden="true" />{t("png")}</DropdownMenuItem>
        <DropdownMenuItem asChild><a href={api("csv")} download><FileSpreadsheet className="size-4" aria-hidden="true" />{t("csv")}</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={api("geojson")} download><FileJson className="size-4" aria-hidden="true" />{t("geojson")}</a></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`/geo-briefing${query ? `?${query}` : ""}`} target="_blank"><Printer className="size-4" aria-hidden="true" />{t("briefing")}</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
