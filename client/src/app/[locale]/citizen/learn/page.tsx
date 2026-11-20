import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { Award, Gamepad2 } from "lucide-react";
import { GuideIcon } from "@/components/home/guide-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("learn") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, tb, th, locale] = await Promise.all([getTranslations("cit.learn"), getTranslations("cit.badges"), getTranslations("cit.home"), getLocale()]);
  const [prog, badges] = await Promise.all([
    ctx.supabase.from("user_progress").select("guide_slug, quiz_score, completed_at").eq("user_id", ctx.user.id),
    ctx.supabase.from("user_badges").select("badge").eq("user_id", ctx.user.id),
  ]);
  const map = new Map((prog.data ?? []).map((p) => [p.guide_slug, p]));
  const done = GUIDES.filter((g) => map.get(g.slug)?.completed_at).length;
  const l = locale as Locale;
  const all = ["first_check", "first_report", "streak_7", "quiz_master", "extension_guard"] as const;
  const have = new Set((badges.data ?? []).map((b) => b.badge));
  return (
    <div className="space-y-6">
      <section className="glass-card space-y-2 rounded-xl p-4">
        <p className="font-medium">{t("progress", { done, total: GUIDES.length })}</p>
        <Progress value={(done / GUIDES.length) * 100} aria-label={t("progress", { done, total: GUIDES.length })} />
      </section>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => { const p = map.get(g.slug); return (
          <li key={g.slug}><Link href={`/learn/${g.slug}`} className="glass-card flex items-center gap-3 rounded-xl p-4 hover:bg-accent">
            <GuideIcon icon={g.icon} className="size-6 text-primary" />
            <span className="flex-1"><span className="block font-medium">{g.title[l]}</span><span className="text-xs text-muted-foreground">{p?.quiz_score !== undefined && p?.quiz_score !== null ? t("score", { score: p.quiz_score }) : t("notStarted")}</span></span>
          </Link></li>
        ); })}
      </ul>
      <section className="space-y-2">
        <h2 className="font-medium">{th("badges")}</h2>
        <ul className="flex flex-wrap gap-2">{all.map((b) => <li key={b}><Badge variant={have.has(b) ? "default" : "outline"} className={have.has(b) ? "gap-1 py-1" : "gap-1 py-1 opacity-50"}><Award className="size-3.5" aria-hidden="true" />{tb(b)}</Badge></li>)}</ul>
      </section>
      <Button asChild variant="outline"><Link href="/learn/quiz"><Gamepad2 className="size-4" aria-hidden="true" />{t("quiz")}</Link></Button>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("learn")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
