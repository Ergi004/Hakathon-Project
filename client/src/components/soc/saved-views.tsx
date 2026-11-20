"use client";

import { Bookmark, BookmarkPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteView, saveView } from "@/app/[locale]/soc/_actions/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, useRouter } from "@/i18n/navigation";

export function SavedViews({ views }: { views: { id: string; name: string; filters: Record<string, string> }[] }) {
  const t = useTranslations("soc.inbox");
  const tu = useTranslations("ui");
  const params = useSearchParams();
  const router = useRouter();
  const [name, setName] = useState("");
  const [, start] = useTransition();
  const current = Object.fromEntries([...params.entries()].filter(([k]) => k !== "page"));

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("views")}>
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center rounded-full border border-border text-xs">
          <Link href={`/soc/inbox?${new URLSearchParams(v.filters)}`} className="inline-flex items-center gap-1 py-1 pr-1 pl-2.5 hover:underline">
            <Bookmark className="size-3" aria-hidden="true" />{v.name}
          </Link>
          <button type="button" className="rounded-full p-1 hover:bg-accent" aria-label={`${t("deleteView")}: ${v.name}`} onClick={() => start(async () => { await deleteView({ id: v.id }); router.refresh(); })}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 text-xs"><BookmarkPlus className="size-3.5" aria-hidden="true" />{t("saveView")}</Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2">
          <label htmlFor="view-name" className="text-xs text-muted-foreground">{t("viewName")}</label>
          <Input id="view-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <Button size="sm" className="w-full" disabled={!name.trim()} onClick={() => start(async () => {
            const r = await saveView({ name: name.trim(), filters: current });
            if (r.ok) { toast.success(tu("saved")); setName(""); router.refresh(); } else toast.error(tu("errorGeneric"));
          })}>{tu("save")}</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
