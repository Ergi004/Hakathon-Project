"use client";

import { useTranslations } from "next-intl";
import type { ColorScale } from "./scales";

/** Class breaks with swatches, plus the "no data" hatch and "low data" dots. */
export function Legend({ scale, title }: { scale: ColorScale; title: string }) {
  const t = useTranslations("geo.legend");
  const labels = scale.colors.map((_, i) => {
    const lo = i === 0 ? null : scale.breaks[i - 1];
    const hi = i < scale.breaks.length ? scale.breaks[i] : null;
    if (lo === null && hi !== null) return `< ${scale.format(hi)}`;
    if (hi === null && lo !== null) return `≥ ${scale.format(lo)}`;
    return `${scale.format(lo!)} – ${scale.format(hi!)}`;
  });
  return (
    <figure className="space-y-2 text-xs" aria-label={title}>
      <figcaption className="font-medium">{title}</figcaption>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {scale.colors.map((c, i) => (
          <li key={c} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3.5 rounded-sm border border-border" style={{ background: c }} aria-hidden="true" />
            <span className="font-mono">{labels[i]}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true"><defs><pattern id="lg-nd" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--geo-nodata)" /><line x1="0" y1="0" x2="0" y2="4" stroke="var(--muted-foreground)" strokeOpacity="0.5" /></pattern></defs><rect width="14" height="14" rx="2" fill="url(#lg-nd)" stroke="var(--border)" /></svg>
          {t("noData")}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true"><defs><pattern id="lg-ld" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="var(--geo-0)" /><circle cx="2" cy="2" r="0.8" fill="var(--muted-foreground)" /></pattern></defs><rect width="14" height="14" rx="2" fill="url(#lg-ld)" stroke="var(--border)" /></svg>
          {t("lowData")}
        </li>
      </ul>
    </figure>
  );
}
