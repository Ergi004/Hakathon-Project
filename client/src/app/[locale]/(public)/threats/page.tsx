import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { CampaignCard } from "@/components/shared/campaign-card";
import { UrlSelect } from "@/components/shared/url-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { fmtDate } from "@/lib/format";
import { getFeedFacets, getThreatFeed } from "@/server/queries/public";

type Search = Promise<{ institution?: string; tactic?: string; month?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "threats" });
  return { title: t("title"), description: t("description") };
}

async function Filters() {
  const [f, t, locale] = await Promise.all([getFeedFacets(), getTranslations("threats"), getLocale()]);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <UrlSelect name="institution" label={t("filterInstitution")} anyLabel={t("anyInstitution")} options={f.institutions.map((v) => ({ value: v, label: v }))} />
      <UrlSelect name="tactic" label={t("filterTactic")} anyLabel={t("anyTactic")} options={f.tactics.map((v) => ({ value: v, label: v.replace(/_/g, " ") }))} />
      <UrlSelect name="month" label={t("filterMonth")} anyLabel={t("anyMonth")} options={f.months.map((v) => ({ value: v, label: fmtDate(`${v}-01`, locale, "MMMM yyyy") }))} />
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const t = await getTranslations("threats");
  const items = await getThreatFeed({ institution: sp.institution, tactic: sp.tactic, month: sp.month });
  if (!items.length) return <EmptyState title={t("empty")} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">{t("count", { count: items.length })}</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.code}><CampaignCard c={c} href={`/threats/${encodeURIComponent(c.code)}`} /></li>
        ))}
      </ul>
    </div>
  );
}

export default async function ThreatsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("threats");
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-16 w-full max-w-2xl" />}>
        <Filters />
      </Suspense>
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>}>
        <Results searchParams={searchParams} />
      </Suspense>
      <p className="text-xs text-muted-foreground">{t("feedNote")} {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON API endpoint, not a page */}
        <a className="underline" href="/api/v1/feed">{t("rss")}</a></p>
    </div>
  );
}
