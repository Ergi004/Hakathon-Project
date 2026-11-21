import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import {
  BellOff, BookOpen, ChevronRight, Circle, CircleCheck, Eye, Flame, GraduationCap, History,
  Lock, MailCheck, ScanSearch, Search, Siren, UserRound, type LucideIcon,
} from "lucide-react";
import { FlagBadge } from "@/components/flags/flag-badge";
import { ScoreRing } from "@/components/flags/score-ring";
import { CampaignCard } from "@/components/shared/campaign-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { flagForScore } from "@/lib/flags";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { getStreak } from "@/server/queries/citizen";
import { getThreatFeed } from "@/server/queries/public";

const BADGES = ["first_check", "first_report", "streak_7", "quiz_master", "extension_guard"] as const;
const BADGE_ICON: Record<(typeof BADGES)[number], LucideIcon> = {
  first_check: ScanSearch, first_report: Siren, streak_7: Flame, quiz_master: GraduationCap, extension_guard: MailCheck,
};
type StepKey = "save" | "check" | "follow" | "learn" | "extension" | "profile";
const STEP_ICON: Record<StepKey, LucideIcon> = { save: History, check: Search, follow: Eye, learn: BookOpen, extension: MailCheck, profile: UserRound };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("home") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, tb, tk, locale] = await Promise.all([getTranslations("cit"), getTranslations("cit.badges"), getTranslations("cit.checks.kinds"), getLocale()]);
  const [recent, follows, badges, progress, installs, streak] = await Promise.all([
    ctx.supabase.from("user_check_links").select("check_id, kind, created_at, checks(score, flag)").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("user_follows").select("institutions(name)").eq("user_id", ctx.user.id),
    ctx.supabase.from("user_badges").select("badge").eq("user_id", ctx.user.id),
    ctx.supabase.from("user_progress").select("guide_slug", { count: "exact", head: true }).eq("user_id", ctx.user.id),
    ctx.supabase.from("extension_installs").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id),
    getStreak(ctx),
  ]);
  const followed = (follows.data ?? []).map((f) => (f.institutions as { name: string } | null)?.name).filter((x): x is string => !!x);
  // Only the 3 newest unresolved campaigns for followed institutions, not the whole feed.
  const warnings = await getThreatFeed({ institutions: followed, excludeStatus: "resolved" }, 3);
  const earned = new Set((badges.data ?? []).map((b) => b.badge));
  const p = ctx.profile;
  const score = p.safety_score;
  const firstName = p.full_name?.trim().split(/\s+/)[0];

  // Same order as the old "next step" logic: the first unfinished step is the one to do now.
  const steps: { k: StepKey; href: string; done: boolean }[] = [
    { k: "save", href: "/citizen/checks", done: !!p.save_history },
    { k: "check", href: "/check", done: !!recent.data?.length },
    { k: "follow", href: "/citizen/alerts", done: followed.length > 0 },
    { k: "learn", href: "/citizen/learn", done: !!progress.count },
    { k: "extension", href: "/citizen/extension", done: !!installs.count },
    { k: "profile", href: "/citizen/settings", done: !!p.full_name },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextKey = steps.find((s) => !s.done)?.k;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {firstName ? t("home.hello", { name: firstName }) : t("home.helloAnon")}
          </h1>
          <p className="text-muted-foreground">{t("home.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full"><Link href="/check"><ScanSearch className="size-4" aria-hidden="true" />{t("home.checkNow")}</Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link href="/report"><Siren className="size-4" aria-hidden="true" />{t("home.report")}</Link></Button>
        </div>
      </header>

      {/* Score + setup checklist */}
      <Card className="py-0">
        <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div className="flex items-center gap-5 border-b border-border p-6 lg:flex-col lg:items-start lg:justify-center lg:border-r lg:border-b-0">
            <ScoreRing score={score} flag={score >= 80 ? "green" : score >= 50 ? "yellow" : score >= 20 ? "orange" : "red"} size="md" />
            <div className="space-y-1">
              <h2 className="font-display text-xl font-medium">{t("home.score")}</h2>
              <p className="text-sm text-muted-foreground">{t("home.scoreHint")}</p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-medium">{t("home.setupTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("home.setupProgress", { done: doneCount, total: steps.length })}</p>
            </div>
            <Progress value={(doneCount / steps.length) * 100} aria-label={t("home.setupProgress", { done: doneCount, total: steps.length })} />
            <ul className="grid gap-2 sm:grid-cols-2">
              {steps.map((s) => {
                const Icon = STEP_ICON[s.k];
                const isNext = s.k === nextKey;
                return (
                  <li key={s.k}>
                    <Link
                      href={s.href}
                      className={cn(
                        "group flex min-h-14 items-center gap-3 rounded-xl border p-3 text-sm transition-colors",
                        isNext ? "border-primary/50 bg-primary/8 hover:bg-primary/12" : "border-border hover:bg-accent/60",
                        s.done && "text-muted-foreground",
                      )}
                    >
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", s.done ? "bg-flag-green/12 text-flag-green" : isNext ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className={cn("min-w-0 flex-1", s.done && "line-through decoration-muted-foreground/40")}>{t(`home.nextActions.${s.k}`)}</span>
                      {s.done ? (
                        <CircleCheck className="size-5 shrink-0 text-flag-green" aria-hidden="true" />
                      ) : isNext ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary">{t("home.go")}<ChevronRight className="size-4" aria-hidden="true" /></span>
                      ) : (
                        <Circle className="size-5 shrink-0 text-border" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Streak + badges */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <Card>
          <CardContent className="flex items-center gap-4">
            <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", streak > 0 ? "bg-flag-orange/15 text-flag-orange" : "bg-muted text-muted-foreground")}>
              <Flame className="size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-3xl leading-none font-bold">{t("home.streakDays", { count: streak })}</p>
              <p className="mt-1 text-sm font-medium">{t("home.streak")}</p>
              <p className="text-xs text-muted-foreground">{t("home.streakHint")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t("home.badges")}</CardTitle>
            <CardDescription>{t("home.badgesHint")}</CardDescription>
            <CardAction className="text-sm text-muted-foreground">{earned.size}/{BADGES.length}</CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {BADGES.map((b) => {
                const Icon = BADGE_ICON[b];
                const has = earned.has(b);
                return (
                  <li key={b} className={cn("flex items-center gap-2.5 rounded-xl border p-2.5 text-sm", has ? "border-flag-yellow/40 bg-flag-yellow/8" : "border-dashed border-border text-muted-foreground")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", has ? "bg-flag-yellow/20 text-flag-yellow" : "bg-muted")}>
                      {has ? <Icon className="size-4" aria-hidden="true" /> : <Lock className="size-3.5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className={cn("block truncate", has && "font-medium text-foreground")}>{tb(b)}</span>
                      {!has && <span className="block text-xs">{t("home.locked")}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent checks + warnings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t("home.recent")}</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm"><Link href="/citizen/checks">{t("home.viewAll")}<ChevronRight className="size-4" aria-hidden="true" /></Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {!recent.data?.length ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <ScanSearch className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t("home.noRecent")}</p>
                <Button asChild size="sm" variant="outline" className="rounded-full"><Link href="/check">{t("home.checkNow")}</Link></Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recent.data.map((r) => {
                  const c = r.checks as { score: number; flag: "red" } | null;
                  return (
                    <li key={r.check_id}>
                      <Link href={`/check/${r.check_id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 text-sm hover:bg-accent/60">
                        {c && <FlagBadge flag={c.flag ?? flagForScore(c.score)} score={c.score} />}
                        <span className="font-medium">{tk(r.kind as "url")}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{fmtAgo(r.created_at, locale)}</span>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t("home.warnings")}</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm"><Link href="/citizen/alerts">{t("home.manageFollows")}<ChevronRight className="size-4" aria-hidden="true" /></Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {!warnings.length ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <BellOff className="size-8 text-flag-green" aria-hidden="true" />
                <p className="font-medium">{t("home.quiet")}</p>
                <p className="text-sm text-muted-foreground">{t("home.noWarnings")}</p>
              </div>
            ) : (
              warnings.map((w) => <CampaignCard key={w.code} c={w} href={`/threats/${encodeURIComponent(w.code)}`} />)
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full max-w-md" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return (
    <div className="mx-auto w-full max-w-[100rem]">
      <Suspense fallback={<HomeSkeleton />}><Content /></Suspense>
    </div>
  );
}
