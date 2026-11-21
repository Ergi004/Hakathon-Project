import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { RegionMiniMap } from "@/components/geo/RegionMiniMap";
import { RegionDetailView } from "@/components/geo/RegionDetailView";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { filtersToQuery, parseGeoFilters } from "@/lib/geo/filters";
import { isMunicipalityCode, regionName } from "@/lib/geo/regions";
import { requireRole } from "@/server/auth";
import { getRegionDetail } from "@/server/geo/stats";

type Params = Promise<{ locale: string; code: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, code } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "geo" });
  return { title: `${regionName(code, locale)} · ${t("title")}` };
}

async function Content({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { code } = await params;
  if (!isMunicipalityCode(code)) notFound();
  const ctx = await requireRole("soc_analyst");
  const locale = await getLocale();
  const t = await getTranslations("geo");
  const filters = parseGeoFilters(await searchParams);
  const detail = await getRegionDetail(ctx.supabase, code, filters, locale);
  if (!detail) notFound();
  const query = filtersToQuery(filters);
  return (
    <>
      <PageHeader title={detail.name} description={filters.mode === "victim" ? t("region.modeVictim") : t("region.modeImitated")} actions={
        <Button asChild variant="outline" size="sm"><Link href={`/soc/geo${query ? `?${query}` : ""}`}><ArrowLeft className="size-4" aria-hidden="true" />{t("region.back")}</Link></Button>
      } />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <RegionDetailView d={detail} query={query} mode={filters.mode} showOpenPage={false} />
        <RegionMiniMap code={code} label={t("region.location", { name: detail.name })} />
      </div>
    </>
  );
}

export default async function RegionPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  return (
    <div className="space-y-5">
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
