"use client";

import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";

const ANY = "__any";

/** A filter select that stores its value in the URL (shareable, works with reload). */
export function UrlSelect({ name, label, anyLabel, options }: { name: string; label: string; anyLabel: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const value = params.get(name) ?? ANY;

  return (
    <div className="space-y-1.5" aria-busy={pending}>
      <Label htmlFor={`f-${name}`} className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => {
          const next = new URLSearchParams(params.toString());
          if (v === ANY) next.delete(name);
          else next.set(name, v);
          next.delete("page");
          start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
        }}
      >
        <SelectTrigger id={`f-${name}`} className="w-full sm:w-52"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
