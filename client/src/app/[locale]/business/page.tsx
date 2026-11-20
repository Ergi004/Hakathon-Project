import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { AlertTriangle } from "lucide-react";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { KpiTile } from "@/components/charts/kpi-tile";
import { SeverityDot } from "@/components/shared/severity-dot";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fmtAgo, fmtDate } from "@/lib/format";
import { getOverview } from "@/server/queries/business";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("overview") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const [o, t, locale] = await Promise.all([getOverview(ctx), getTranslations("biz"), getLocale()]);
  return (
    <div className="space-y-6">
      {!o.hasInstitution && (
        <Alert><AlertTriangle className="size-4" /><AlertDescription className="flex flex-wrap items-center gap-3">{t("noInstitution")}<Button asChild size="sm" variant="outline"><Link href="/business/onboarding">{t("overview.setupCta")}</Link></Button></AlertDescription></Alert>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label={t("overview.openAlerts")} value={o.openAlerts} />
        <KpiTile label={t("overview.activeCampaigns")} value={o.activeCampaigns} />
        <KpiTile label={t("overview.takedowns")} value={o.takedowns} />
        <KpiTile label={t("overview.customerReports")} value={o.customerReports} series={o.days.map((d) => d.count)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="glass-card space-y-2 rounded-xl p-4">
          <h2 className="font-medium">{t("overview.trend")}</h2>
          <WeeklyBars xKey="day" data={o.days.map((d) => ({ day: fmtDate(d.day, locale, "d MMM"), count: d.count }))} label={t("overview.customerReports")} summary={t("overview.trendSr", { summary: o.days.map((d) => `${d.day}: ${d.count}`).join("; ") })} />
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="font-medium">{t("overview.urgent")}</h2>
          {!o.urgent.length ? <p className="text-sm text-muted-foreground">{t("overview.noUrgent")}</p> : (
            <ul className="space-y-2">
              {o.urgent.map((a) => (
                <li key={a.id}><Link href="/business/alerts" className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent"><SeverityDot severity={a.severity} /><span className="flex-1 truncate">{a.title}</span><span className="text-xs text-muted-foreground">{fmtAgo(a.created_at, locale)}</span></Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("overview")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
