"use client";

import { useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Single-choice toggle group stored in the URL. The first option is the default and clears the param. */
export function UrlToggle({
  name,
  label,
  options,
  className,
}: {
  name: string;
  label: string;
  options: { value: string; label: ReactNode; ariaLabel?: string }[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const fallback = options[0]?.value ?? "";
  const value = params.get(name) ?? fallback;

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={label}
      aria-busy={pending}
      value={value}
      onValueChange={(v) => {
        if (!v) return; // keep one option selected
        const next = new URLSearchParams(params.toString());
        if (v === fallback) next.delete(name);
        else next.set(name, v);
        next.delete("page"); // a new filter starts on page 1
        start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
      }}
      className={cn("flex-wrap", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} aria-label={o.ariaLabel} className="gap-1.5 px-3">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
