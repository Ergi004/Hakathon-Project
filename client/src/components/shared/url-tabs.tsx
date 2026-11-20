"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Tabs bound to ?tab= so they are linkable (e.g. "Create takedown" → ?tab=takedowns). */
export function UrlTabs({ tabs, defaultTab }: { tabs: { value: string; label: string; content: ReactNode }[]; defaultTab: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get("tab") ?? defaultTab;
  return (
    <Tabs value={value} onValueChange={(v) => { const n = new URLSearchParams(params.toString()); n.set("tab", v); router.replace(`${pathname}?${n}`, { scroll: false }); }}>
      <div className="overflow-x-auto">
        <TabsList>{tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
      </div>
      {tabs.map((t) => <TabsContent key={t.value} value={t.value} className="pt-4">{t.content}</TabsContent>)}
    </Tabs>
  );
}
