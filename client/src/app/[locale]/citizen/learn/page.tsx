import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ArrowRight, Check, Flame, Gamepad2, GraduationCap, Lock, MailCheck, ScanSearch, Siren, Trophy, type LucideIcon } from "lucide-react";
import { GuideIcon } from "@/components/home/guide-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";

const BADGES = ["first_check", "first_report", "streak_7", "quiz_master", "extension_guard"] as const;
const BADGE_ICON: Record<(typeof BADGES)[number], LucideIcon> = { first_check: ScanSearch, first_report: Siren, streak_7: Flame, quiz_master: GraduationCap, extension_guard: MailCheck };
type State = "done" | "progress" | "next" | "todo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("learn") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, tb, th, tl, locale] = await Promise.all([getTranslations("cit.learn"), getTranslations("cit.badges"), getTranslations("cit.home"), getTranslations("learn"), getLocale()]);
  const l = locale as Locale;
  const [prog, badges] = await Promise.all([
    ctx.supabase.from("user_progress").select("guide_slug, quiz_score, completed_at").eq("user_id", ctx.user.id),
    ctx.supabase.from("user_badges").select("badge").eq("user_id", ctx.user.id),
  ]);
  const map = new Map((prog.data ?? []).map((p) => [p.guide_slug, p]));
  const have = new Set((badges.data ?? []).map((b) => b.badge));

  const firstOpen = GUIDES.findIndex((g) => !map.get(g.slug)?.completed_at);
  const path = GUIDES.map((g, i) => {
    const p = map.get(g.slug);
    const state: State = p?.completed_at ? "done" : p ? "progress" : i === firstOpen ? "next" : "todo";
    return { g, p, state };
  });
  const done = path.filter((x) => x.state === "done").length;
  const scores = (prog.data ?? []).map((p) => p.quiz_score).filter((s): s is number => s !== null && s !== undefined);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const upNext = path.find((x) => x.state === "next" || x.state === "progress");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-8">
        {/* Progress summary */}
        <Card className="py-0">
          <CardContent className="grid gap-0 p-0 md:grid-cols-[1fr_auto]">
            <div className="space-y-3 p-6">
              <p className="font-display text-xl font-medium">{t("progress", { done, total: GUIDES.length })}</p>
              <Progress value={(done / GUIDES.length) * 100} className="h-2.5" aria-label={t("progress", { done, total: GUIDES.length })} />
              <ol className="flex gap-1.5" aria-hidden="true">
                {path.map(({ g, state }) => (
                  <li key={g.slug} className={cn("grid size-7 place-items-center rounded-full border text-xs", state === "done" ? "border-flag-green/40 bg-flag-green/15 text-flag-green" : state === "next" || state === "progress" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                    <GuideIcon icon={g.icon} className="size-3.5" />
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex items-center gap-3 border-t border-border p-6 md:border-t-0 md:border-l">
              <Trophy className="size-8 text-flag-yellow" aria-hidden="true" />
              <div>
                <p className="font-display text-3xl leading-none font-bold">{avg === null ? "–" : `${avg}%`}</p>
                <p className="mt-1 text-xs text-muted-foreground">{avg === null ? t("noScore") : t("avgScore")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* The path */}
        <ol className="relative space-y-4">
          <span aria-hidden="true" className="absolute top-6 bottom-6 left-[1.4rem] w-0.5 bg-border" />
          {path.map(({ g, p, state }, i) => {
            const cta = state === "done" ? t("review") : state === "progress" ? t("continue") : t("start");
            const highlight = state === "next" || state === "progress";
            return (
              <li key={g.slug} className="relative flex gap-4">
                <span
                  className={cn(
                    "relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 bg-background font-display font-semibold",
                    state === "done" && "border-flag-green bg-flag-green text-background",
                    highlight && "border-primary text-primary ring-4 ring-primary/15",
                    state === "todo" && "border-border text-muted-foreground",
                  )}
                >
                  {state === "done" ? <Check className="size-5" aria-hidden="true" /> : i + 1}
                </span>
                <Card className={cn("relative flex-1 gap-3 py-5 transition-colors hover:border-primary/40", highlight && "border-primary/50")}>
                  <CardHeader className="px-5">
                    <div className="flex items-start gap-3">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                        <GuideIcon icon={g.icon} className="size-5" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("stepN", { n: i + 1 })} · {tl("minutes")}</p>
                        <CardTitle className="font-display text-lg leading-snug">
                          <Link href={`/learn/${g.slug}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
                            {g.title[l]}
                          </Link>
                        </CardTitle>
                      </div>
                    </div>
                    <CardAction>
                      <Badge variant="outline" className={cn("gap-1", state === "done" && "border-flag-green/40 text-flag-green", highlight && "border-primary/40 text-primary")}>
                        {state === "done" && <Check aria-hidden="true" />}
                        {t(`status.${state}`)}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="space-y-3 px-5">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{g.summary[l]}</p>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      {p?.quiz_score !== null && p?.quiz_score !== undefined ? (
                        <span className="flex min-w-40 flex-1 items-center gap-2">
                          <Progress value={p.quiz_score} className="h-1.5 max-w-32" aria-label={t("score", { score: p.quiz_score })} />
                          <span className="text-xs text-muted-foreground">{t("score", { score: p.quiz_score })}</span>
                        </span>
                      ) : (
                        <span className="flex-1 text-xs text-muted-foreground">{tl("quizQuestions", { count: g.quiz.length })}</span>
                      )}
                      <span className={cn("inline-flex items-center gap-1 font-medium", highlight ? "text-primary" : "text-foreground/80")}>
                        {cta}<ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-20 lg:col-span-4">
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardDescription>{upNext ? t("continueTitle") : t("allDoneTitle")}</CardDescription>
            <CardTitle className="font-display text-xl">{upNext ? upNext.g.title[l] : t("allDoneTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{upNext ? upNext.g.summary[l] : t("allDoneBody")}</p>
            <Button asChild className="w-full rounded-full">
              <Link href={upNext ? `/learn/${upNext.g.slug}` : "/learn/quiz"}>
                {upNext ? (upNext.state === "progress" ? t("continue") : t("start")) : t("quiz")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-display text-lg"><Gamepad2 className="size-5 text-primary" aria-hidden="true" />{t("quizTitle")}</CardTitle>
            <CardDescription>{t("quizBody")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full rounded-full"><Link href="/learn/quiz">{t("quiz")}</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{th("badges")}</CardTitle>
            <CardDescription>{t("badgesHint")}</CardDescription>
            <CardAction className="text-sm text-muted-foreground">{have.size}/{BADGES.length}</CardAction>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {BADGES.map((b) => {
                const Icon = BADGE_ICON[b];
                const has = have.has(b);
                return (
                  <li key={b} className={cn("flex items-center gap-3 rounded-xl border p-2.5 text-sm", has ? "border-flag-yellow/40 bg-flag-yellow/8" : "border-dashed border-border text-muted-foreground")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", has ? "bg-flag-yellow/20 text-flag-yellow" : "bg-muted")}>
                      {has ? <Icon className="size-4" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
                    </span>
                    <span className={cn("flex-1", has && "font-medium text-foreground")}>{tb(b)}</span>
                    {!has && <span className="text-xs">{th("locked")}</span>}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function LearnSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl lg:col-span-4" />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.learn");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<LearnSkeleton />}><Content /></Suspense>
    </div>
  );
}
