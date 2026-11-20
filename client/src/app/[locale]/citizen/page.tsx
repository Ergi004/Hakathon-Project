import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { ArrowRight, Award, Flame, Lightbulb } from "lucide-react";
import { ScoreRing } from "@/components/flags/score-ring";
import { FlagBadge } from "@/components/flags/flag-badge";
import { CampaignCard } from "@/components/shared/campaign-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { flagForScore } from "@/lib/flags";
import { fmtAgo } from "@/lib/format";
import { getStreak } from "@/server/queries/citizen";
import { getThreatFeed } from "@/server/queries/public";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("home") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, tb, tk, locale] = await Promise.all([getTranslations("cit"), getTranslations("cit.badges"), getTranslations("cit.checks.kinds"), getLocale()]);
  const [recent, follows, badges, progress, installs, streak, feed] = await Promise.all([
    ctx.supabase.from("user_check_links").select("check_id, kind, created_at, checks(score, flag)").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(5),
    ctx.supabase.from("user_follows").select("institutions(name)").eq("user_id", ctx.user.id),
    ctx.supabase.from("user_badges").select("badge").eq("user_id", ctx.user.id),
    ctx.supabase.from("user_progress").select("guide_slug", { count: "exact", head: true }).eq("user_id", ctx.user.id),
    ctx.supabase.from("extension_installs").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id),
    getStreak(ctx),
    getThreatFeed(),
  ]);
  const followed = (follows.data ?? []).map((f) => (f.institutions as { name: string } | null)?.name).filter((x): x is string => !!x);
  const warnings = feed.filter((c) => c.imitated_name && followed.includes(c.imitated_name) && c.status !== "resolved").slice(0, 3);
  const p = ctx.profile;
  const next = !recent.data?.length && !p.save_history ? { k: "save", href: "/citizen/checks" } : !recent.data?.length ? { k: "check", href: "/check" } : !followed.length ? { k: "follow", href: "/citizen/alerts" } : !progress.count ? { k: "learn", href: "/citizen/learn" } : !installs.count ? { k: "extension", href: "/citizen/extension" } : !p.full_name ? { k: "profile", href: "/citizen/settings" } : { k: "allDone", href: "/check" };
  const score = p.safety_score;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[auto_1fr_auto]">
        <section className="glass-card flex items-center gap-4 rounded-xl p-5">
          <ScoreRing score={score} flag={score >= 80 ? "green" : score >= 50 ? "yellow" : score >= 20 ? "orange" : "red"} size="md" />
          <div><h2 className="font-display text-lg font-medium">{t("home.score")}</h2><p className="max-w-56 text-sm text-muted-foreground">{t("home.scoreHint")}</p></div>
        </section>
        <section className="glass-card flex flex-col justify-between gap-3 rounded-xl p-5">
          <h2 className="inline-flex items-center gap-2 font-medium"><Lightbulb className="size-4 text-flag-yellow" aria-hidden="true" />{t("home.next")}</h2>
          <p className="text-lg">{t(`home.nextActions.${next.k as "check"}`)}</p>
          <Button asChild className="self-start"><Link href={next.href}>{t("home.next")} <ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
        </section>
        <section className="glass-card flex flex-col items-center justify-center rounded-xl p-5 text-center">
          <Flame className="size-6 text-flag-orange" aria-hidden="true" />
          <p className="font-display text-4xl font-bold">{streak}</p>
          <p className="text-sm font-medium">{t("home.streak")}</p>
          <p className="max-w-40 text-xs text-muted-foreground">{t("home.streakHint")}</p>
        </section>
      </div>
      {(badges.data ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">{t("home.badges")}</h2>
          <ul className="flex flex-wrap gap-2">{badges.data!.map((b) => <li key={b.badge}><Badge variant="secondary" className="gap-1 py-1"><Award className="size-3.5" aria-hidden="true" />{tb(b.badge as "first_check")}</Badge></li>)}</ul>
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="font-medium">{t("home.recent")}</h2>
          {!recent.data?.length ? <p className="text-sm text-muted-foreground">{t("home.noRecent")}</p> : (
            <ul className="space-y-2">
              {recent.data.map((r) => { const c = r.checks as { score: number; flag: "red" } | null; return (
                <li key={r.check_id}><Link href={`/check/${r.check_id}`} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent">{c && <FlagBadge flag={c.flag ?? flagForScore(c.score)} score={c.score} />}<span>{tk(r.kind as "url")}</span><span className="ml-auto text-xs text-muted-foreground">{fmtAgo(r.created_at, locale)}</span></Link></li>
              ); })}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="font-medium">{t("home.warnings")}</h2>
          {!warnings.length ? <p className="text-sm text-muted-foreground">{t("home.noWarnings")}</p> : warnings.map((w) => <CampaignCard key={w.code} c={w} href={`/threats/${encodeURIComponent(w.code)}`} />)}
        </section>
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("home")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
