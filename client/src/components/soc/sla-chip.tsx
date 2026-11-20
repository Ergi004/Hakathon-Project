"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const h = Math.floor(Math.abs(ms) / 3_600_000);
  const m = Math.floor((Math.abs(ms) % 3_600_000) / 60_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

/** SLA countdown chip (A7): updates every minute, red when overdue. */
export function SlaChip({ due }: { due: string | null }) {
  const t = useTranslations("soc.takedowns");
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 60_000);
    return () => { cancelAnimationFrame(first); clearInterval(id); };
  }, []);
  if (!due || now === null) return null;
  const left = Date.parse(due) - now;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap", left < 0 ? "border-flag-red/50 bg-flag-red/10" : left < 4 * 3_600_000 ? "border-flag-orange/50 bg-flag-orange/10" : "border-border")}>
      <Clock className="size-3" aria-hidden="true" />
      {left < 0 ? t("overdue", { value: fmt(left) }) : t("remaining", { value: fmt(left) })}
    </span>
  );
}
