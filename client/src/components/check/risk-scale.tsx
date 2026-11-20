"use client";

import { useTranslations } from "next-intl";
import { DEFAULT_THRESHOLDS, FLAG_LEVELS, type FlagLevel } from "@/lib/flags";
import { cn } from "@/lib/utils";

const BAND_BG: Record<Exclude<FlagLevel, "grey">, string> = {
  green: "bg-flag-green",
  yellow: "bg-flag-yellow",
  orange: "bg-flag-orange",
  red: "bg-flag-red",
  darkred: "bg-flag-darkred",
};

/** 0-100 risk bar split at the verdict thresholds, with a marker at the score. Explains what the number means. */
export function RiskScale({ score, flag }: { score: number; flag: Exclude<FlagLevel, "grey"> }) {
  const t = useTranslations("check");
  const tf = useTranslations("flags");
  const th = DEFAULT_THRESHOLDS;
  const edges = [0, th.yellow, th.orange, th.red, th.darkred, 100];
  const bands = FLAG_LEVELS.filter((f): f is Exclude<FlagLevel, "grey"> => f !== "grey");
  const pos = Math.min(100, Math.max(0, score));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{t("scale.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("scale.explain", { score })}</p>
      </div>
      <div className="relative pt-3" aria-hidden="true">
        <div
          className="absolute top-0 size-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-foreground transition-[left] duration-700"
          style={{ left: `${pos}%` }}
        />
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {bands.map((b, i) => (
            <div
              key={b}
              className={cn(BAND_BG[b], b === flag ? "opacity-100" : "opacity-30")}
              style={{ width: `${edges[i + 1] - edges[i]}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-0.5 text-xs" aria-hidden="true">
        {bands.map((b, i) => (
          <span key={b} className="text-center font-medium" style={{ width: `${edges[i + 1] - edges[i]}%` }}>
            {b === flag ? tf(b) : ""}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{t("scale.low")}</span>
        <span>{t("scale.high")}</span>
      </div>
    </div>
  );
}
