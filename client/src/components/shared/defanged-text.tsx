"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

/** Defang for display: hxxp:// and [.] (SPEC hard rule 5). Pure, shared with server code. */
export function defangValue(v: string): string {
  return v.replace(/^http(s?):\/\//i, "hxxp$1://").replace(/(?<!\[)\.(?!\])/g, "[.]");
}
function refangValue(v: string): string {
  return v.replace(/^hxxp/i, "http").replace(/\[\.\]/g, ".");
}

/**
 * Mono text shown defanged, with Copy (copies the defanged form) and an
 * explicit Reveal toggle. `onReveal` lets staff pages audit reveals (SPEC 15.2).
 */
export function DefangedText({
  value,
  className,
  revealable = true,
  onReveal,
}: {
  value: string;
  className?: string;
  revealable?: boolean;
  onReveal?: () => void;
}) {
  const t = useTranslations("ui");
  const [revealed, setRevealed] = useState(false);
  const defanged = defangValue(refangValue(value));
  const shown = revealed ? refangValue(value) : defanged;

  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 align-middle", className)}>
      <span className="min-w-0 truncate font-mono text-[0.85em]" title={revealed ? t("revealWarning") : t("defanged")}>
        {shown}
      </span>
      <CopyButton value={defanged} />
      {revealable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-pressed={revealed}
          aria-label={revealed ? t("hide") : t("reveal")}
          onClick={() => {
            if (!revealed) onReveal?.();
            setRevealed((r) => !r);
          }}
        >
          {revealed ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
        </Button>
      )}
    </span>
  );
}
