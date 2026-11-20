"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

export function Pager({ page, pages }: { page: number; pages: number }) {
  const t = useTranslations("ui");
  const pathname = usePathname();
  const params = useSearchParams();
  if (pages <= 1) return null;
  const href = (p: number) => {
    const n = new URLSearchParams(params.toString());
    n.set("page", String(p));
    return `${pathname}?${n}`;
  };
  return (
    <nav className="flex items-center justify-end gap-2" aria-label={t("page", { page, pages })}>
      <span className="text-xs text-muted-foreground">{t("page", { page, pages })}</span>
      <Button asChild={page > 1} variant="outline" size="icon" className="size-8" disabled={page <= 1}>
        {page > 1 ? <Link href={href(page - 1)} aria-label={t("previous")}><ChevronLeft className="size-4" /></Link> : <ChevronLeft className="size-4" />}
      </Button>
      <Button asChild={page < pages} variant="outline" size="icon" className="size-8" disabled={page >= pages}>
        {page < pages ? <Link href={href(page + 1)} aria-label={t("next")}><ChevronRight className="size-4" /></Link> : <ChevronRight className="size-4" />}
      </Button>
    </nav>
  );
}
