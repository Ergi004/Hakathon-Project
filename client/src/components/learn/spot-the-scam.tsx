"use client";

import { ArrowRight, CheckCircle2, Mail, MessageSquare, QrCode, RotateCcw, Share2, ShieldAlert, ShieldCheck, Trophy, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MaskedText } from "@/components/shared/masked-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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

const noopSubscribe = () => () => {};

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CHANNEL_ICON: Record<string, typeof Mail> = { email: Mail, qr: QrCode, social: Share2 };

/** One dot per message: green right, red wrong, outlined for the current one. */
function ProgressDots({ results, current, total, label }: { results: boolean[]; current: number; total: number; label: (n: number, ok: boolean) => string }) {
  return (
    <ol className="flex gap-1.5" aria-label={label(0, true)}>
      {Array.from({ length: total }).map((_, i) => {
        const r = results[i];
        return (
          <li
            key={i}
            aria-label={r === undefined ? undefined : label(i + 1, r)}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors duration-300",
              r === true && "bg-flag-green",
              r === false && "bg-flag-red",
              r === undefined && i === current && "bg-primary",
              r === undefined && i !== current && "bg-muted",
            )}
          />
        );
      })}
    </ol>
  );
}

/** SPEC 7 /learn/quiz: 10 random labelled messages; score is local only. */
export function SpotTheScam({ pool }: { pool: QuizItem[] }) {
  const t = useTranslations("quiz");
  const tc = useTranslations("channel");
  const tl = useTranslations("learn");
  const [seed, setSeed] = useState(0);
  // The round is random, so it is only drawn in the browser. The server (and hydration) render a placeholder,
  // otherwise server and client would pick different messages and hydration would fail.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const items = useMemo(() => {
    if (!isClient) return [];
    const scams = shuffle(pool.filter((p) => p.scam)).slice(0, ROUND / 2);
    const legit = shuffle(pool.filter((p) => !p.scam)).slice(0, ROUND - scams.length);
    return shuffle([...scams, ...legit]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle on "play again"
  }, [pool, seed, isClient]);
  const [results, setResults] = useState<boolean[]>([]);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const best = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readBest,
    () => null,
  );
  const idx = results.length - (answer === null ? 0 : 1);
  const score = results.filter(Boolean).length;
  const finished = answer === null && results.length >= items.length && items.length > 0;
  const item = items[idx];

  function choose(saysScam: boolean) {
    if (answer !== null || !item) return;
    setAnswer(saysScam);
    setResults((r) => [...r, saysScam === item.scam]);
  }
  function next() {
    if (results.length >= items.length) saveBest(score);
    setAnswer(null);
  }
  function restart() {
    setSeed((s) => s + 1);
    setResults([]);
    setAnswer(null);
  }

  // Arrow keys answer, Enter moves on (focus lands on the Next button after answering).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") choose(true);
      if (e.key === "ArrowRight") choose(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (answer !== null) nextRef.current?.focus();
  }, [answer]);

  const dotLabel = (n: number, ok: boolean) => (n === 0 ? t("recap") : t("answerN", { n, result: ok ? t("correctShort") : t("wrongShort") }));

  if (!isClient) return <Skeleton className="h-[28rem] w-full rounded-2xl" />;
  if (!items.length) return <p className="text-muted-foreground">{t("empty")}</p>;

  if (finished) {
    const ratio = score / items.length;
    return (
      <Card className="py-0" role="status">
        <CardContent className="space-y-6 p-6 text-center md:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-flag-yellow/15">
            <Trophy className="size-8 text-flag-yellow" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h2 className="font-display text-xl font-medium text-muted-foreground">{t("resultTitle")}</h2>
            <p className="font-display text-5xl font-bold tabular-nums">{t("result", { score, total: items.length })}</p>
            <p className="text-lg">{ratio >= 0.9 ? t("great") : ratio >= 0.6 ? t("ok") : t("low")}</p>
          </div>
          <div className="mx-auto max-w-sm space-y-2">
            <p className="text-sm font-medium">{t("recap")}</p>
            <ProgressDots results={results} current={-1} total={items.length} label={dotLabel} />
          </div>
          {best !== null && <p className="text-sm text-muted-foreground">{t("best", { score: best })}</p>}
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button size="lg" className="rounded-full" onClick={restart}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("again")}
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full"><Link href="/learn">{tl("allGuides")}</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const correct = answer !== null && answer === item.scam;
  const ChannelIcon = CHANNEL_ICON[item.channel] ?? MessageSquare;

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-[box-shadow] duration-300",
        answer !== null && (correct ? "ring-2 ring-flag-green/60" : "ring-2 ring-flag-red/60"),
      )}
    >
      {/* Progress and score */}
      <div className="space-y-3 border-b border-border p-5 md:px-8">
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium">{t("question", { current: idx + 1, total: items.length })}</p>
          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="size-4 text-flag-yellow" aria-hidden="true" />
            {t("scoreLabel")} <span className="font-semibold text-foreground tabular-nums">{score}</span>
          </p>
        </div>
        <ProgressDots results={results} current={idx} total={items.length} label={dotLabel} />
      </div>

      <CardContent className="space-y-6 p-5 md:p-8">
        {/* The message, as it would arrive */}
        <div className="space-y-3">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <ChannelIcon aria-hidden="true" />
            {t("from", { channel: tc(item.channel as "sms") })}
          </Badge>
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <ChannelIcon className="size-4" />
            </span>
            <MaskedText key={item.id} text={item.text} className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-base md:text-lg" />
          </div>
        </div>

        {answer === null ? (
          <div className="space-y-3">
            <p className="text-center font-display text-lg font-medium">{t("prompt")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" variant="outline" className="h-16 rounded-xl border-2 border-flag-red/40 text-base hover:border-flag-red hover:bg-flag-red/10" onClick={() => choose(true)}>
                <ShieldAlert className="size-5 text-flag-red" aria-hidden="true" /> {t("scam")}
              </Button>
              <Button size="lg" variant="outline" className="h-16 rounded-xl border-2 border-flag-green/40 text-base hover:border-flag-green hover:bg-flag-green/10" onClick={() => choose(false)}>
                <ShieldCheck className="size-5 text-flag-green" aria-hidden="true" /> {t("legit")}
              </Button>
            </div>
            <p className="hidden text-center text-xs text-muted-foreground md:block">{t("keysHint")}</p>
          </div>
        ) : (
          <div
            aria-live="polite"
            className={cn(
              "flex flex-col gap-5 rounded-xl border p-4 md:flex-row md:items-center md:justify-between md:p-5",
              correct ? "border-flag-green/30 bg-flag-green/10" : "border-flag-red/30 bg-flag-red/10",
            )}
          >
            <div className="flex min-w-0 gap-4">
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", correct ? "bg-flag-green/20 text-flag-green" : "bg-flag-red/20 text-flag-red")}>
                {correct ? <CheckCircle2 className="size-6" aria-hidden="true" /> : <XCircle className="size-6" aria-hidden="true" />}
              </span>
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="font-display text-lg leading-tight font-semibold">
                    {item.scam ? (correct ? t("rightScam") : t("wrongScam")) : correct ? t("rightLegit") : t("wrongLegit")}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("youSaid", { choice: answer ? t("scam") : t("legit") })}</p>
                </div>
                {item.scam && item.why.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {item.why.map((w) => (
                      <li key={w} className="flex gap-2">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-flag-red" aria-hidden="true" />
                        {w}
                      </li>
                    ))}
                  </ul>
                ) : !item.scam ? (
                  <p className="flex gap-2 text-sm">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-flag-green" aria-hidden="true" />
                    {t("legitNote")}
                  </p>
                ) : null}
              </div>
            </div>
            <Button ref={nextRef} size="lg" className="h-12 w-full shrink-0 gap-2 rounded-full px-6 text-base md:w-auto" onClick={next}>
              {results.length < items.length ? t("next") : t("finish")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
