"use client";

import { Microscope } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeLandingPage } from "@/app/[locale]/soc/intel/actions";
import { DefangedText } from "@/components/shared/defanged-text";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

export interface LandingCandidate {
  url: string;
  /** Sanitised URL that would be submitted (victim e-mails/phones replaced). */
  shown: string;
  replaced: string[];
  block: string | null;
  state: "none" | "pending" | "completed" | "failed";
}

/**
 * Analyst-triggered landing-page analysis (urlscan.io). Two-step confirm: the
 * analyst sees exactly what leaves the platform before anything is sent.
 */
export function LandingPanel({ scanId, configured, visibility, candidates }: { scanId: string; configured: boolean; visibility: string; candidates: LandingCandidate[] }) {
  const t = useTranslations("soc.intel.landing");
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tx = (key: string, fallback: string): string => (t.has(key as never) ? t(key as never) : fallback);

  if (!configured) return <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>;
  if (!candidates.length) return <p className="text-sm text-muted-foreground">{t("noLinks")}</p>;

  const run = (url: string) =>
    start(async () => {
      const r = await analyzeLandingPage({ scanId, url });
      setConfirming(null);
      if (!r.ok) {
        toast.error(tx(`error.${r.message ?? r.error}`, t("error.generic")));
        return;
      }
      toast.success(r.data.reused ? t("reused") : t("submitted"));
      router.refresh();
    });

  return (
    <ul className="space-y-2">
      {candidates.map((c) => (
        <li key={c.url} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DefangedText value={c.shown} revealable={false} className="max-w-full" />
            {c.block ? (
              <span className="text-xs text-muted-foreground">{tx(`block.${c.block}`, c.block)}</span>
            ) : c.state === "pending" ? (
              <span className="text-xs text-muted-foreground" role="status">{t("running")}</span>
            ) : confirming === c.url ? (
              <span className="flex gap-2">
                <Button size="sm" onClick={() => run(c.url)} disabled={pending}>{pending ? t("sending") : t("confirm")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>{t("cancel")}</Button>
              </span>
            ) : (
              <Button size="sm" variant={c.state === "completed" ? "outline" : "default"} onClick={() => setConfirming(c.url)}>
                <Microscope className="size-3.5" aria-hidden="true" />
                {c.state === "completed" ? t("again") : t("analyze")}
              </Button>
            )}
          </div>
          {c.replaced.length > 0 && <p className="pt-1 text-xs text-muted-foreground">{t("sanitized", { what: c.replaced.map((k) => tx(`replaced.${k}`, k)).join(", ") })}</p>}
          {confirming === c.url && <p className="pt-2 text-xs" role="alert">{t("confirmText", { visibility })}</p>}
        </li>
      ))}
    </ul>
  );
}
