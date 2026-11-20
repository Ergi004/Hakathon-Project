import { Activity, Gavel, LayoutGrid, Rss, ShieldCheck, Siren, Table2, X } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { WIDE } from "@/components/home/section";
import { EmptyState } from "@/components/layout/empty-state";
import { CampaignCard } from "@/components/shared/campaign-card";
import { CheckAggregates } from "@/components/shared/check-aggregates";
import { UrlSelect } from "@/components/shared/url-select";
import { UrlToggle } from "@/components/shared/url-toggle";
import { ThreatTable } from "@/components/threats/threat-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFeedFacets, getThreatFeed } from "@/server/queries/public";

type Search = Promise<{ institution?: string; tactic?: string; month?: string; status?: string; view?: string }>;

const STATUSES = ["all", "confirmed", "takedown_in_progress", "monitoring", "resolved"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "threats" });
  return { title: t("title"), description: t("description") };
}

/** Totals across the whole public feed, so the numbers do not jump while filtering. */
async function Overview() {
  const [all, t] = await Promise.all([getThreatFeed(), getTranslations("threats.stats")]);
  const stats = [
    { icon: Activity, label: t("total"), value: all.length, tone: "text-primary bg-primary/10" },
    { icon: Siren, label: t("active"), value: all.filter((c) => c.status === "confirmed").length, tone: "text-flag-red bg-flag-red/12" },
    { icon: Gavel, label: t("takedown"), value: all.filter((c) => c.status === "takedown_in_progress").length, tone: "text-flag-orange bg-flag-orange/14" },
    { icon: ShieldCheck, label: t("resolved"), value: all.filter((c) => c.status === "resolved").length, tone: "text-flag-green bg-flag-green/12" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ icon: Icon, label, value, tone }) => (
        <Card key={label} size="sm" className="py-0">
          <CardContent className="flex items-center gap-3 py-4">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone)}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
            </div>
          </CardContent>
        </Card>
      ))}
    </dl>
  );
}

async function Filters({ searchParams }: { searchParams: Search }) {
  const [f, t, tc, locale, sp] = await Promise.all([getFeedFacets(), getTranslations("threats"), getTranslations("campaignStatus"), getLocale(), searchParams]);
  const filtered = !!(sp.institution || sp.tactic || sp.month || sp.status);
  return (
    <Card className="py-0">
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <UrlToggle
            name="status"
            label={t("filterStatus")}
            options={STATUSES.map((s) => ({ value: s, label: s === "all" ? t("statusAll") : tc(s) }))}
          />
          <UrlToggle
            name="view"
            label={t("view.label")}
            className="self-start"
            options={[
              { value: "grid", label: <><LayoutGrid className="size-4" aria-hidden="true" />{t("view.grid")}</> },
              { value: "table", label: <><Table2 className="size-4" aria-hidden="true" />{t("view.table")}</> },
            ]}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <UrlSelect name="institution" label={t("filterInstitution")} anyLabel={t("anyInstitution")} options={f.institutions.map((v) => ({ value: v, label: v }))} />
          <UrlSelect name="tactic" label={t("filterTactic")} anyLabel={t("anyTactic")} options={f.tactics.map((v) => ({ value: v, label: v.replace(/_/g, " ") }))} />
          <UrlSelect name="month" label={t("filterMonth")} anyLabel={t("anyMonth")} options={f.months.map((v) => ({ value: v, label: fmtDate(`${v}-01`, locale, "MMMM yyyy") }))} />
          {filtered && (
            <Button asChild variant="ghost" className="sm:ml-auto">
              <Link href={sp.view === "table" ? "/threats?view=table" : "/threats"} scroll={false}>
                <X className="size-4" aria-hidden="true" />
                {t("clear")}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const t = await getTranslations("threats");
  const feed = await getThreatFeed({ institution: sp.institution, tactic: sp.tactic, month: sp.month });
  const items = sp.status && sp.status !== "all" ? feed.filter((c) => c.status === sp.status) : feed;
  if (!items.length) return <EmptyState title={t("empty")} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">{t("count", { count: items.length })}</p>
      {sp.view === "table" ? (
        <ThreatTable items={items} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((c) => (
            <li key={c.code}><CampaignCard c={c} href={`/threats/${encodeURIComponent(c.code)}`} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function ThreatsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("threats");
  return (
    <div className={cn(WIDE, "space-y-8 pt-10 pb-20 md:pt-14")}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{t("title")}</h1>
          <p className="max-w-[62ch] text-lg text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild variant="outline" className="self-start md:self-auto">
          <a href="/api/v1/feed"><Rss className="size-4" aria-hidden="true" />{t("rss")}</a>
        </Button>
      </header>

      <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[4.5rem] rounded-xl" />)}</div>}>
        <Overview />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
        <CheckAggregates />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-36 w-full rounded-xl" />}>
        <Filters searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>}>
        <Results searchParams={searchParams} />
      </Suspense>

      <p className="text-xs text-muted-foreground">{t("feedNote")}</p>
    </div>
  );
}
