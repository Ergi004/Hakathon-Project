"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label, className, size = "icon" }: { value: string; label?: string; className?: string; size?: "icon" | "sm" }) {
  const t = useTranslations("ui");
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  }
  const Icon = done ? Check : Copy;
  return (
    <Button type="button" variant="ghost" size={size === "icon" ? "icon" : "sm"} onClick={copy} className={cn(size === "icon" && "size-7", className)} aria-label={label ?? t("copy")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {size === "sm" && <span>{done ? t("copied") : (label ?? t("copy"))}</span>}
      <span className="sr-only" aria-live="polite">{done ? t("copied") : ""}</span>
    </Button>
  );
}
