"use client";

import { useSearchParams } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Tabs bound to ?tab= so they are linkable (e.g. "Create takedown" → ?tab=takedowns).
 * A tab whose `content` is null is rendered on the server only once selected; it shows a
 * skeleton until that render arrives. Switching tabs resets ?page=.
 */
export function UrlTabs({ tabs, defaultTab }: { tabs: { value: string; label: string; content: ReactNode }[]; defaultTab: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [value, setValue] = useOptimistic(params.get("tab") ?? defaultTab);
  const onValueChange = (v: string) => {
    const n = new URLSearchParams(params.toString());
    n.set("tab", v);
    n.delete("page");
    startTransition(() => {
      setValue(v);
      router.replace(`${pathname}?${n}`, { scroll: false });
    });
  };
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <div className="overflow-x-auto">
        <TabsList>{tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="pt-4">
          {t.content ?? <Skeleton className="h-64 w-full rounded-xl" />}
        </TabsContent>
      ))}
    </Tabs>
  );
}
