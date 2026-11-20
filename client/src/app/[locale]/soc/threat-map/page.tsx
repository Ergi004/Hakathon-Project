import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { HBar } from "@/components/charts/hbar";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
  const blocks: [string, { name: string; value: number }[], string][] = [
    [t("byInstitution"), p.byInstitution, "var(--chart-1)"],
    [t("tactics"), p.tactics.map((x) => ({ ...x, name: x.name.replace(/_/g, " ") })), "var(--chart-2)"],
    [t("registrars"), p.registrars, "var(--chart-5)"],
    [t("hosting"), p.hosting, "var(--chart-3)"],
    [t("channels"), p.channels.map((x) => ({ ...x, name: tc(x.name as "sms") })), "var(--chart-4)"],
  ];
  if (!p.byInstitution.length && !p.tactics.length && !p.registrars.length) return <EmptyState title={tu("noData")} />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {blocks.map(([title, data, color]) => (
        <section key={title} className="glass-card space-y-2 rounded-xl p-4">
          <h2 className="font-medium">{title}</h2>
          {data.length ? <HBar data={data} label={title} summary={sum(data)} color={color} /> : <p className="text-sm text-muted-foreground">{tu("noData")}</p>}
        </section>
      ))}
      <section className="glass-card space-y-2 rounded-xl p-4 lg:col-span-2">
        <h2 className="font-medium">{t("heatmap")}</h2>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-[10px]" aria-label={t("heatmap")}>
            <thead><tr><th />{Array.from({ length: 24 }, (_, h) => <th key={h} scope="col" className="font-normal text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {p.heat.map((row, d) => (
                <tr key={d}>
                  <th scope="row" className="pr-1 text-right font-normal text-muted-foreground">{days[d]}</th>
                  {row.map((v, h) => (
                    <td key={h} title={`${days[d]} ${h}:00 · ${v}`} className={cn("size-5 rounded-sm text-center", v === 0 ? "bg-muted" : "bg-primary text-primary-foreground")} style={v ? { opacity: 0.25 + 0.75 * (v / max) } : undefined}>
                      <span className="sr-only">{v}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default async function ThreatMapPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("threatMap")} />
      <Suspense fallback={<div className="grid gap-5 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>}><Charts /></Suspense>
    </div>
  );
}
