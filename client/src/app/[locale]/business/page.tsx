import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AlertTriangle, BellRing, ChevronRight, FileDown, Flag, Gavel, Globe, Megaphone, MessageSquareWarning, ShieldCheck, Wand2 } from "lucide-react";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { SeverityDot } from "@/components/shared/severity-dot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtAgo, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { getOverview } from "@/server/queries/business";

const SEV_EDGE: Record<string, string> = { critical: "border-l-flag-darkred", high: "border-l-flag-red", medium: "border-l-flag-orange", low: "border-l-flag-yellow" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("overview") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const [o, t, tn, locale] = await Promise.all([getOverview(ctx), getTranslations("biz"), getTranslations("business.nav"), getLocale()]);
  const quick = [
    { href: "/business/onboarding", label: t("ov.quickSetup"), Icon: Wand2 },
    { href: "/business/domains", label: t("ov.quickDomains"), Icon: Globe },
    { href: "/business/notices", label: t("ov.quickNotice"), Icon: Megaphone },
    { href: "/business/reports/export", label: t("ov.quickExport"), Icon: FileDown },
  ];
  return (
    <DashPage title={ctx.org.name} subtitle={t("pages.overview")}>
      {!o.hasInstitution && (
        <Alert className="border-flag-orange/40 bg-flag-orange/5">
          <AlertTriangle className="size-4 text-flag-orange" />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
            {t("noInstitution")}
            <Button asChild size="sm" className="rounded-full"><Link href="/business/onboarding">{t("overview.setupCta")}</Link></Button>
          </AlertDescription>
        </Alert>
      )}

      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <li><StatCard icon={BellRing} label={t("overview.openAlerts")} value={o.openAlerts} tone={o.openAlerts ? "text-flag-red" : "text-flag-green"} /></li>
        <li><StatCard icon={Flag} label={t("overview.activeCampaigns")} value={o.activeCampaigns} tone="text-flag-orange" /></li>
        <li><StatCard icon={Gavel} label={t("overview.takedowns")} value={o.takedowns} tone="text-primary" /></li>
        <li><StatCard icon={MessageSquareWarning} label={t("overview.customerReports")} value={o.customerReports} series={o.days.map((d) => d.count)} /></li>
      </ul>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">{t("overview.trend")}</CardTitle>
            <CardDescription>{t("ov.last30")}</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="sm"><Link href="/business/reports">{tn("reports")}<ChevronRight className="size-4" aria-hidden="true" /></Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <WeeklyBars
              xKey="day"
              data={o.days.map((d) => ({ day: fmtDate(d.day, locale, "d MMM"), count: d.count }))}
              label={t("overview.customerReports")}
              summary={t("overview.trendSr", { summary: o.days.map((d) => `${d.day}: ${d.count}`).join("; ") })}
            />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-5">
            <CardTitle className="font-display text-lg">{t("overview.urgent")}</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm"><Link href="/business/alerts">{t("ov.viewAll")}<ChevronRight className="size-4" aria-hidden="true" /></Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent className="p-0">
            {!o.urgent.length ? (
              <EmptyPanel icon={ShieldCheck} tone="text-flag-green" title={t("overview.noUrgent")} />
            ) : (
              <ul className="divide-y divide-border">
                {o.urgent.map((a) => (
                  <li key={a.id}>
                    <Link href="/business/alerts" className={cn("flex items-center gap-3 border-l-4 px-5 py-4 text-sm hover:bg-accent/40", SEV_EDGE[a.severity] ?? "border-l-border")}>
                      <SeverityDot severity={a.severity} />
                      <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtAgo(a.created_at, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="quick" className="space-y-3">
        <h2 id="quick" className="font-display text-lg font-medium">{t("ov.quick")}</h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quick.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/40">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </DashPage>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <Skeleton className="h-14 w-72" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  return <Suspense fallback={<OverviewSkeleton />}><Content /></Suspense>;
}
