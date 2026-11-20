"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Debounced search box stored in ?q= ("/" focuses it). */
export function UrlSearch({ label, name = "q", className }: { label: string; name?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(name) ?? "");
  const [, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get(name) ?? "") === value) return;
      const next = new URLSearchParams(params.toString());
      if (value) next.set(name, value);
      else next.delete(name);
      next.delete("page");
      start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(id);
  }, [value, name, params, pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={className}>
      <label htmlFor={`s-${name}`} className="sr-only">{label}</label>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input ref={ref} id={`s-${name}`} type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={label} className="pl-9" />
      </div>
    </div>
  );
}
