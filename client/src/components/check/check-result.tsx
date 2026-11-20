"use client";

import { CircleCheck, Flag, Share2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FlagBadge } from "@/components/flags/flag-badge";
import { ScoreRing } from "@/components/flags/score-ring";
import { ReasonList } from "@/components/shared/reason-list";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { FLAG_STYLES, type FlagLevel } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { RiskScale } from "./risk-scale";
import type { Reason } from "@/server/detection/types";

export interface ResultView {
  score: number;
  flag: FlagLevel;
  reasons: Reason[];
  campaign?: { code?: string } | null;
  matchedInstitution?: { name: string } | null;
}

/** Large result: ring, badge, top reasons, "what to do now", actions (SPEC 7 /check). */
export function CheckResult({
  result,
  checkId,
  explanation,
  onReport,
  reporting,
  onReset,
}: {
  result: ResultView;
  checkId?: string | null;
  explanation?: string | null;
  onReport?: () => void;
  reporting?: boolean;
  onReset?: () => void;
}) {
  const t = useTranslations("check");
  const tf = useTranslations("flags");
  const tr = useTranslations("reasonList");
  const locale = useLocale();
  const todo = t.raw(`todo.${result.flag}`) as string[];
  const style = FLAG_STYLES[result.flag];

  async function share() {
    const url = checkId ? `${window.location.origin}/${locale}/check/${checkId}` : window.location.origin;
    const text = t("shareText", { flag: tf(result.flag), score: result.score, url });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success(t("shareCopied"));
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <section aria-live="polite" aria-labelledby="result-heading" className={cn("glass-card space-y-6 overflow-hidden rounded-3xl border-2 p-5 md:p-8", style.border)}>
      <div className={cn("-mx-5 -mt-5 flex flex-col items-center gap-6 px-5 py-6 text-center md:-mx-8 md:-mt-8 md:flex-row md:items-center md:px-8 md:py-8 md:text-left", style.bg)}>
        <ScoreRing score={result.flag === "grey" ? null : result.score} flag={result.flag} size="lg" glow />
        <div className="space-y-2">
          <FlagBadge flag={result.flag} score={result.flag === "grey" ? null : result.score} className="text-sm" />
          <h2 id="result-heading" className="font-display text-3xl font-bold text-balance md:text-4xl">
            {t(`headline.${result.flag}`)}
          </h2>
          <p className="max-w-[60ch] text-base text-foreground/80 md:text-lg">{t(`lead.${result.flag}`)}</p>
          <div className="flex flex-wrap justify-center gap-2 text-sm md:justify-start">
            {result.campaign?.code && (
              <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs">{t("campaign", { code: result.campaign.code })}</span>
            )}
            {result.matchedInstitution?.name && (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{t("institution", { name: result.matchedInstitution.name })}</span>
            )}
          </div>
        </div>
      </div>

      {result.flag !== "grey" && <RiskScale score={result.score} flag={result.flag} />}

      {explanation && result.flag !== "grey" && (
        <div className="flex gap-3 rounded-xl bg-muted/60 p-4 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <span className="sr-only">{t("summary")}: </span>
            {explanation}
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-display text-lg font-medium">{tr("title")}</h3>
          <ReasonList reasons={result.reasons} />
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-lg font-medium">{t("todoTitle")}</h3>
          <ol className="space-y-2">
            {todo.map((item, i) => (
              <li key={item} className="flex items-start gap-3 rounded-lg border border-border bg-card/60 p-3 text-sm">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", style.bg, style.text)} aria-hidden="true">
                  {result.flag === "green" ? <CircleCheck className="size-4" /> : i + 1}
                </span>
                <span className="pt-1">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {onReport && (
          <Button onClick={onReport} disabled={reporting} size="lg" variant={result.flag === "green" ? "outline" : "default"}>
            <Flag className="size-4" aria-hidden="true" />
            {reporting ? t("reporting") : t("reportThis")}
          </Button>
        )}
        {result.flag !== "grey" && (
          <Button variant="outline" size="lg" onClick={share}>
            <Share2 className="size-4" aria-hidden="true" /> {t("shareWarning")}
          </Button>
        )}
        {onReset ? (
          <Button variant="ghost" onClick={onReset}>{t("checkAnother")}</Button>
        ) : (
          <Button variant="ghost" asChild>
            <Link href="/check">{t("checkAnother")}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
