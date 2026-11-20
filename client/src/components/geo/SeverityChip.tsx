"use client";

import { Eye, Flame, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Severity } from "@/server/geo/hotspots";
import { cn } from "@/lib/utils";

const STYLE: Record<Severity, { icon: typeof Eye; cls: string }> = {
  watch: { icon: Eye, cls: "border-flag-yellow/60 bg-flag-yellow/15" },
  elevated: { icon: TriangleAlert, cls: "border-flag-orange/60 bg-flag-orange/15" },
  critical: { icon: Flame, cls: "border-flag-darkred/60 bg-flag-darkred/20" },
};

/** Severity: icon + word, never colour alone. */
export function SeverityChip({ severity }: { severity: Severity }) {
  const t = useTranslations("geo.severity");
  const { icon: Icon, cls } = STYLE[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", cls)}>
      <Icon className="size-3.5" aria-hidden="true" />{t(severity)}
    </span>
  );
}
