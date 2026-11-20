"use client";

import { AtSign, FileWarning, Link2, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Reason } from "@/server/detection/types";

const GROUP_ICON = {
  links: Link2,
  content: MessageSquareWarning,
  sender: AtSign,
  attachments: FileWarning,
  reputation: ShieldAlert,
} as const;

/** Top reasons first, the rest behind a toggle (SPEC 6.3, 3). */
export function ReasonList({ reasons, initial = 3, showWeights = false }: { reasons: Reason[]; initial?: number; showWeights?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const [all, setAll] = useState(false);
  const visible = all ? reasons : reasons.slice(0, initial);
  const rest = reasons.length - initial;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {visible.map((r) => {
          const Icon = GROUP_ICON[r.group] ?? ShieldAlert;
          return (
            <li key={r.code} className="flex gap-3 rounded-lg border border-border bg-card/60 p-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm">{locale === "en" ? r.text_en : r.text_sq}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`reasonGroups.${r.group}`)}
                  {showWeights && r.weight > 0 && <span className="font-mono"> · +{r.weight}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <Button type="button" variant="ghost" size="sm" onClick={() => setAll((a) => !a)} aria-expanded={all}>
          {all ? t("ui.showLess") : t("ui.showMore", { count: rest })}
        </Button>
      )}
    </div>
  );
}
