import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

const COLOR = { low: "bg-flag-green", medium: "bg-flag-yellow", high: "bg-flag-orange", critical: "bg-flag-red" } as const;

export function SeverityDot({ severity, className }: { severity: Enums<"severity">; className?: string }) {
  const t = useTranslations("severity");
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", COLOR[severity])} />
      {t(severity)}
    </span>
  );
}
