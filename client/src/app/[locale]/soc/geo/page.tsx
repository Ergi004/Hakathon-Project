import { AlertCircle, Terminal } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { GeoExplorer } from "@/components/geo/GeoExplorer";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { parseGeoFilters } from "@/lib/geo/filters";
import { requireRole } from "@/server/auth";
import { regionIdMaps } from "@/server/geo/regions";
import { getGeoData } from "@/server/geo/stats";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "geo" });
  return { title: t("title") };
}

function MapSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[70vh] w-full rounded-xl" />
        <div className="space-y-3"><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div>
      </div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Search }) {
  const ctx = await requireRole("soc_analyst");
  const [t, locale] = await Promise.all([getTranslations("geo"), getLocale()]);
  const filters = parseGeoFilters(await searchParams);
  // Load first, render after: errors in the queries become the error state below.
  const loaded = await Promise.all([getGeoData(ctx.supabase, filters, locale), regionIdMaps(ctx.supabase)]).catch(() => null);
  if (!loaded) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertTitle>{t("error.title")}</AlertTitle>
        <AlertDescription>{t("error.body")}</AlertDescription>
      </Alert>
    );
  }
  const [data, { codeById }] = loaded;
  if (!data.ready) {
    return (
      <Alert>
        <Terminal className="size-4" aria-hidden="true" />
        <AlertTitle>{t("setup.title")}</AlertTitle>
        <AlertDescription><p>{t("setup.body")}</p><pre className="mt-2 rounded bg-muted p-2 text-xs">npm run db:push{"\n"}npm run seed:geo</pre></AlertDescription>
      </Alert>
    );
  }
  return <GeoExplorer data={data} filters={filters} idToCode={Object.fromEntries([...codeById.entries()])} />;
}

export default async function GeoPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("geo");
  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<MapSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
