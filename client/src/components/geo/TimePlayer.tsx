"use client";

import { Pause, Play, Rows3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

/** Day-by-day player over the selected range (1 day per second). Never autoplays. */
export function TimePlayer({ days, totals, index, onChange }: { days: string[]; totals: number[]; index: number | null; onChange: (i: number | null) => void }) {
  const t = useTranslations("geo.player");
  const locale = useLocale();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (index === null) onChange(0);
      else if (index >= days.length - 1) setPlaying(false);
      else onChange(index + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [playing, index, days.length, onChange]);

  if (days.length < 2) return null;
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const label = index === null ? t("wholeRange", { from: fmt(days[0]), to: fmt(days[days.length - 1]) }) : fmt(days[index]);

  return (
    <div className="glass-card space-y-2 rounded-xl p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => { if (!playing && (index === null || index >= days.length - 1)) onChange(0); setPlaying((p) => !p); }} aria-pressed={playing}>
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          {playing ? t("pause") : t("play")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setPlaying(false); onChange(null); }} disabled={index === null}>
          <Rows3 className="size-4" aria-hidden="true" />{t("all")}
        </Button>
        <span className="ml-auto text-sm font-medium" aria-live="polite">{label}{index !== null && <span className="ml-2 font-mono text-xs text-muted-foreground">{t("reports", { count: totals[index] })}</span>}</span>
      </div>
      <Slider
        min={0}
        max={days.length - 1}
        step={1}
        value={[index ?? days.length - 1]}
        onValueChange={([v]) => { setPlaying(false); onChange(v); }}
        aria-label={t("slider")}
        aria-valuetext={label}
      />
      <div className="h-10" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={totals.map((v, i) => ({ v, i }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="v" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {totals.map((_, i) => <Cell key={i} fill={index === null || index === i ? "var(--geo-4)" : "var(--geo-1)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
