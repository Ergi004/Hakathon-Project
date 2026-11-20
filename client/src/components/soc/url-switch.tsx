"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePathname, useRouter } from "@/i18n/navigation";

/** On/off filter stored in the URL as ?name=1 (shareable, survives reload). */
export function UrlSwitch({ name, label }: { name: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const checked = params.get(name) === "1";

  return (
    <div className="flex h-9 items-center gap-2" aria-busy={pending}>
      <Switch
        id={`f-${name}`}
        checked={checked}
        onCheckedChange={(v) => {
          const next = new URLSearchParams(params.toString());
          if (v) next.set(name, "1");
          else next.delete(name);
          next.delete("page");
          start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
        }}
      />
      <Label htmlFor={`f-${name}`} className="text-sm">{label}</Label>
    </div>
  );
}
