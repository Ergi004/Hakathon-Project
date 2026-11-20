import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

/** Number, label, trend arrow and sparkline (SPEC 3). */
export function KpiTile({
  label,
  value,
  trend,
  series,
  className,
}: {
  label: string;
  value: string | number;
  /** Signed change, e.g. +12 or -3 (already formatted units are up to the caller). */
  trend?: { value: number; display?: string };
  series?: number[];
  className?: string;
}) {
  const t = useTranslations("kpi");
  const dir = !trend || trend.value === 0 ? "flat" : trend.value > 0 ? "up" : "down";
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : ArrowRight;
  const shown = trend?.display ?? (trend ? Math.abs(trend.value).toString() : "");

  return (
    <Card className={cn("glass-card gap-2 py-4", className)}>
      <CardContent className="space-y-2 px-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-end justify-between gap-3">
          <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
          {trend && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Arrow className="size-3.5" aria-hidden="true" />
              <span>
                {dir === "flat" ? t("trendFlat") : t(dir === "up" ? "trendUp" : "trendDown", { value: shown })}
              </span>
            </span>
          )}
        </div>
        {series && series.length > 1 && <Sparkline data={series} />}
      </CardContent>
    </Card>
  );
}

export function KpiTileSkeleton() {
  return (
    <Card className="glass-card gap-2 py-4">
      <CardContent className="space-y-3 px-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
