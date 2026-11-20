"use client";

import { CheckCircle2, ShieldAlert, ShieldCheck, Trophy, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { MaskedText } from "@/components/shared/masked-text";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";

export interface QuizItem {
  id: string;
  text: string;
  scam: boolean;
  channel: string;
  why: string[];
}

const KEY = "mburoja.quiz.best";
const ROUND = 10;
const listeners = new Set<() => void>();

function readBest(): number | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function saveBest(score: number) {
  try {
    if (score > (readBest() ?? -1)) window.localStorage.setItem(KEY, String(score));
  } catch {
    /* storage unavailable (private mode): the score just isn't remembered */
  }
  listeners.forEach((l) => l());
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** SPEC 7 /learn/quiz: 10 random labelled messages; score is local only. */
export function SpotTheScam({ pool }: { pool: QuizItem[] }) {
  const t = useTranslations("quiz");
  const tc = useTranslations("channel");
  const tl = useTranslations("learn");
  const [seed, setSeed] = useState(0);
  const items = useMemo(() => {
    const scams = shuffle(pool.filter((p) => p.scam)).slice(0, ROUND / 2);
    const legit = shuffle(pool.filter((p) => !p.scam)).slice(0, ROUND - scams.length);
    return shuffle([...scams, ...legit]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle on "play again"
  }, [pool, seed]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const best = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readBest,
    () => null,
  );
  const finished = idx >= items.length;

  if (!items.length) return <p className="text-muted-foreground">{t("empty")}</p>;

  if (finished) {
    const ratio = score / items.length;
    return (
      <div className="glass-card space-y-4 rounded-2xl p-8 text-center" role="status">
        <Trophy className="mx-auto size-10 text-flag-yellow" aria-hidden="true" />
        <h2 className="font-display text-2xl font-bold">{t("resultTitle")}</h2>
        <p className="font-display text-4xl font-bold">{t("result", { score, total: items.length })}</p>
        <p className="text-muted-foreground">{ratio >= 0.9 ? t("great") : ratio >= 0.6 ? t("ok") : t("low")}</p>
        {best !== null && <p className="text-sm text-muted-foreground">{t("best", { score: best })}</p>}
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => { setSeed((s) => s + 1); setIdx(0); setScore(0); setAnswer(null); }}>{t("again")}</Button>
          <Button asChild variant="outline"><Link href="/learn">{tl("allGuides")}</Link></Button>
        </div>
      </div>
    );
  }

  const item = items[idx];
  const correct = answer !== null && answer === item.scam;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("question", { current: idx + 1, total: items.length })}</p>
        <Progress value={(idx / items.length) * 100} aria-hidden="true" />
      </div>
      <div className="glass-card space-y-3 rounded-2xl p-5 md:p-6">
        <p className="text-xs text-muted-foreground">{tc(item.channel as "sms")}</p>
        <MaskedText text={item.text} className="text-base" />
      </div>
      {answer === null ? (
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" className="h-14 border-flag-red/50" onClick={() => { setAnswer(true); if (item.scam) setScore((s) => s + 1); }}>
            <ShieldAlert className="size-5 text-flag-red" aria-hidden="true" /> {t("scam")}
          </Button>
          <Button size="lg" variant="outline" className="h-14 border-flag-green/50" onClick={() => { setAnswer(false); if (!item.scam) setScore((s) => s + 1); }}>
            <ShieldCheck className="size-5 text-flag-green" aria-hidden="true" /> {t("legit")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite">
          <p className="inline-flex items-center gap-2 font-display text-lg font-medium">
            {correct ? <CheckCircle2 className="size-5 text-flag-green" aria-hidden="true" /> : <XCircle className="size-5 text-flag-red" aria-hidden="true" />}
            {item.scam ? (correct ? t("rightScam") : t("wrongScam")) : correct ? t("rightLegit") : t("wrongLegit")}
          </p>
          {item.why.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="mb-1 font-medium">{t("why")}</p>
              <ul className="list-disc space-y-1 pl-5">{item.why.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <Button onClick={() => { if (idx + 1 >= items.length) saveBest(score); setIdx((i) => i + 1); setAnswer(null); }}>{idx + 1 < items.length ? t("next") : t("finish")}</Button>
        </div>
      )}
    </div>
  );
}
