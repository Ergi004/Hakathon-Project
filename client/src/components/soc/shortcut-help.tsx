"use client";

import { Keyboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const KEYS = [["J / K", "jk"], ["Enter", "enter"], ["X", "x"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["/", "slash"], ["?", "help"], ["⌘ K", "k"]] as const;

/** "?" dialog listing keyboard shortcuts (SPEC 10). */
export function ShortcutHelp() {
  const t = useTranslations("soc.inbox");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "?" && tag !== "INPUT" && tag !== "TEXTAREA") setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("shortcuts")}><Keyboard className="size-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("shortcuts")}</DialogTitle></DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {KEYS.map(([k, key]) => (
            <div key={key} className="contents">
              <dt><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd></dt>
              <dd>{t(`shortcutList.${key}`)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
