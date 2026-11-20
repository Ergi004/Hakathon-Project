"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Guide } from "@/content/learn";
import { cn } from "@/lib/utils";
import { recordGuideQuiz } from "@/server/actions/learning";

export function GuideQuiz({ guide }: { guide: Guide }) {
  const t = useTranslations("learn");
  const l = useLocale() as "sq" | "en";
  const [answers, setAnswers] = useState<(number | null)[]>(guide.quiz.map(() => null));
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();
  const score = answers.filter((a, i) => a === guide.quiz[i].answer).length;

  function check() {
    setChecked(true);
    start(async () => {
      const res = await recordGuideQuiz({ slug: guide.slug, score: Math.round((score / guide.quiz.length) * 100) });
      if (res.ok && res.data.saved) setSaved(true);
    });
  }

  return (
    <div className="space-y-5">
      {guide.quiz.map((q, qi) => (
        <fieldset key={qi} className="glass-card space-y-3 rounded-xl p-4">
          <legend className="sr-only">{q.q[l]}</legend>
          <p className="font-medium">{qi + 1}. {q.q[l]}</p>
          <RadioGroup value={answers[qi]?.toString() ?? ""} onValueChange={(v) => !checked && setAnswers((a) => a.map((x, i) => (i === qi ? Number(v) : x)))} className="gap-2">
            {q.options.map((o, oi) => {
              const isRight = checked && oi === q.answer;
              const isWrong = checked && answers[qi] === oi && oi !== q.answer;
              return (
                <label key={oi} htmlFor={`q${qi}o${oi}`} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm", isRight && "border-flag-green bg-flag-green/10", isWrong && "border-flag-red bg-flag-red/10", !checked && "hover:bg-accent")}>
                  <RadioGroupItem id={`q${qi}o${oi}`} value={String(oi)} disabled={checked} />
                  <span className="flex-1">{o[l]}</span>
                  {isRight && <CheckCircle2 className="size-4 text-flag-green" aria-label={t("correct")} />}
                  {isWrong && <XCircle className="size-4 text-flag-red" aria-label={t("wrong")} />}
                </label>
              );
            })}
          </RadioGroup>
          {checked && <p className="text-sm text-muted-foreground">{q.why[l]}</p>}
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3" aria-live="polite">
        {!checked ? (
          <Button onClick={check} disabled={answers.some((a) => a === null)}>{t("checkAnswer")}</Button>
        ) : (
          <>
            <p className="font-display text-lg font-medium">{t("score", { score, total: guide.quiz.length })}</p>
            <Button variant="outline" onClick={() => { setAnswers(guide.quiz.map(() => null)); setChecked(false); setSaved(false); }}>{t("retry")}</Button>
            {saved && <p className="text-sm text-muted-foreground">{t("progressSaved")}</p>}
          </>
        )}
      </div>
    </div>
  );
}
