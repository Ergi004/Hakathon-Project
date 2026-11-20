import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { HBar } from "@/components/charts/hbar";
import { ChartBar } from "lucide-react";
import { DashPage, EmptyPanel, Panel } from "@/components/layout/dash";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { getPatterns } from "@/server/queries/soc";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("threatMap") };
}

async function Charts() {
  const ctx = await requireRole("soc_analyst");
  const [p, t, tc, tu] = await Promise.all([getPatterns(ctx.supabase), getTranslations("soc.patterns"), getTranslations("channel"), getTranslations("ui")]);
  const sum = (rows: { name: string; value: number }[]) => t("srPrefix", { summary: rows.map((r) => `${r.name}: ${r.value}`).join("; ") || tu("noData") });
  const max = Math.max(1, ...p.heat.flat());
  const days = t.raw("weekdays") as string[];
  const blocks: [string, { name: string; value: number }[], string, string?][] = [
    [t("byInstitution"), p.byInstitution, "var(--chart-1)"],
    [t("tactics"), p.tactics.map((x) => ({ ...x, name: x.name.replace(/_/g, " ") })), "var(--chart-2)"],
    [t("registrars"), p.registrars, "var(--chart-5)"],
    [t("hosting"), p.hosting, "var(--chart-3)"],
    [t("channels"), p.channels.map((x) => ({ ...x, name: tc(x.name as "sms") })), "var(--chart-4)", "lg:col-span-2"],
  ];
  if (!p.byInstitution.length && !p.tactics.length && !p.registrars.length) return <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={ChartBar} title={tu("noData")} /></div>;
  return (
    <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      {blocks.map(([title, data, color, span]) => (
        <Panel key={title} title={title} className={span}>
          {data.length ? <HBar data={data} label={title} summary={sum(data)} color={color} /> : <p className="py-10 text-center text-sm text-muted-foreground">{tu("noData")}</p>}
        </Panel>
      ))}
      <Panel title={t("heatmap")} className="lg:col-span-2 2xl:col-span-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-1 text-xs" aria-label={t("heatmap")}>
            <thead><tr><th className="w-12" />{Array.from({ length: 24 }, (_, h) => <th key={h} scope="col" className="font-normal text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {p.heat.map((row, d) => (
                <tr key={d}>
                  <th scope="row" className="pr-1 text-right font-normal text-muted-foreground">{days[d]}</th>
                  {row.map((v, h) => (
                    <td key={h} title={`${days[d]} ${h}:00 · ${v}`} className={cn("h-7 rounded-md text-center", v === 0 ? "bg-muted" : "bg-primary text-primary-foreground")} style={v ? { opacity: 0.25 + 0.75 * (v / max) } : undefined}>
                      <span className="sr-only">{v}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export default async function ThreatMapPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("threatMap")} subtitle={tx("pages.threatMap")}>
      <Suspense fallback={<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>}><Charts /></Suspense>
    </DashPage>
  );
}
