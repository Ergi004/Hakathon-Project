"use client";

import { useTranslations } from "next-intl";
import { VerdictChip } from "./intel-panel";

/** Compact cell: latest intel verdict, domain age, subdomain count. */
export function IntelCell({ v }: { v?: { verdict: string; ageDays: number | null; subdomains: number } }) {
  const t = useTranslations("intel");
  if (!v) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <VerdictChip status="done" verdict={v.verdict} />
      <span className={v.ageDays !== null && v.ageDays < 30 ? "text-xs font-medium text-flag-red" : "text-xs text-muted-foreground"}>{v.ageDays === null ? "?" : t("ageShort", { count: v.ageDays })}</span>
      {v.subdomains > 0 && <span className="text-xs text-muted-foreground">· {t("subCount", { count: v.subdomains })}</span>}
    </span>
  );
}
