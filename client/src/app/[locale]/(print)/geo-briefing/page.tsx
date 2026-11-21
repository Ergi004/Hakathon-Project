import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Fragment, Suspense } from "react";
import { BriefingMap, PrintButton } from "@/components/geo/BriefingMap";
import { SeverityChip } from "@/components/geo/SeverityChip";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { filtersToQuery, parseGeoFilters } from "@/lib/geo/filters";
import { guardOrRedirect, requireRole } from "@/server/auth";
import { getGeoData } from "@/server/geo/stats";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "geo.briefing" }))("title"), robots: { index: false } };
}

/** One-page A4 briefing: map, top 5 hot zones and the filters used. Aggregates only. */
async function Briefing({ searchParams }: { searchParams: Search }) {
  const ctx = await guardOrRedirect(() => requireRole("soc_analyst"));
  const [t, locale] = await Promise.all([getTranslations("geo"), getLocale()]);
  const filters = parseGeoFilters(await searchParams);
  const data = await getGeoData(ctx.supabase, filters, locale);
  const query = filtersToQuery(filters);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const filterList = [
    [t("filters.mode"), t(`filters.modes.${filters.mode}`)],
    [t("filters.range"), `${fmt(data.window.from)} – ${fmt(data.window.to)}`],
    filters.institution && [t("filters.institution"), data.options.institutions.find((i) => i.id === filters.institution)?.name ?? "—"],
    filters.campaign && [t("filters.campaign"), filters.campaign],
    filters.tactic && [t("filters.tactic"), filters.tactic],
    filters.channel && [t("filters.channel"), filters.channel],
    filters.minFlag && [t("filters.minFlag"), filters.minFlag],
    filters.source && [t("filters.source"), t(`filters.sources.${filters.source}`)],
    filters.confirmed && [t("filters.confirmed"), "✓"],
  ].filter(Boolean) as [string, string][];
  return (
    <article className="geo-print-page mx-auto max-w-[190mm] space-y-4 p-6 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Mburoja · {t("briefing.kicker")}</p>
          <h1 className="font-display text-2xl">{t("briefing.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("briefing.generated", { time: new Date().toLocaleString(locale) })}{data.demo ? ` · ${t("demo")}` : ""}</p>
        </div>
        <PrintButton query={query} />
      </header>
      <div className="grid grid-cols-[1fr_1.1fr] gap-5">
        <BriefingMap metrics={data.metrics} hot={data.hot} title={t("briefing.title")} />
        <div className="space-y-4 text-sm">
          <section>
            <h2 className="mb-1 font-medium">{t("briefing.filters")}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">{filterList.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></Fragment>)}</dl>
          </section>
          <section>
            <h2 className="mb-1 font-medium">{t("briefing.totals")}</h2>
            <p className="text-xs">{t("briefing.totalsLine", { total: data.total, prev: data.prevTotal, unknown: data.unknown.count, pct: Math.round(data.unknown.share * 100) })}</p>
          </section>
          <section>
            <h2 className="mb-1 font-medium">{t("briefing.top5")}</h2>
            {data.hot.length ? (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-1">#</th><th>{t("hot.zone")}</th><th>{t("hot.severityCol")}</th><th className="text-right">{t("hot.observedExpected")}</th><th className="text-right">{t("hot.spike")}</th></tr></thead>
                <tbody>
                  {data.hot.slice(0, 5).map((z, i) => (
                    <tr key={z.code} className="border-b border-border/60 align-top">
                      <td className="py-1">{i + 1}</td>
                      <td>{z.members.length > 1 ? t("hot.zoneName", { name: z.name }) : z.name}{z.topCampaign?.code ? <span className="block text-muted-foreground">{z.topCampaign.code}{z.topInstitution ? ` · ${z.topInstitution.name}` : ""}</span> : null}</td>
                      <td><SeverityChip severity={z.severity} /></td>
                      <td className="text-right font-mono">{z.observed} / {z.expected.toFixed(1)}</td>
                      <td className="text-right font-mono">{z.spike === null ? "—" : `${z.spike.toFixed(1)}×`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-xs text-muted-foreground">{t("hot.empty")}</p>}
          </section>
        </div>
      </div>
      <footer className="border-t border-border pt-2 text-[10px] text-muted-foreground">{t("briefing.footer")}</footer>
    </article>
  );
}

export default async function BriefingPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-[250mm] w-[190mm]" />}>
      <Briefing searchParams={searchParams} />
    </Suspense>
  );
}
