import { AlertTriangle, Clock, Siren, UserX } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { HotZonesTile } from "@/components/geo/HotZonesTile";
import { FlagStack } from "@/components/charts/flag-stack";
import { KpiTile, KpiTileSkeleton } from "@/components/charts/kpi-tile";
import { PageHeader } from "@/components/layout/page-header";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { fmtAgo, fmtDate } from "@/lib/format";
import { requireRole } from "@/server/auth";
import { getDailyVolume, getNeedsAttention, getRecentActivity, getSocKpis } from "@/server/queries/soc";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" });
  return { title: t("command") };
}

async function Kpis() {
  const ctx = await requireRole("soc_analyst");
  const [k, vol, t] = await Promise.all([getSocKpis(ctx.supabase), getDailyVolume(ctx.supabase), getTranslations("soc.kpi")]);
  const daily = vol.map((d) => ["green", "yellow", "orange", "red", "darkred", "grey"].reduce((a, f) => a + Number(d[f] ?? 0), 0));
  const high = vol.map((d) => Number(d.red ?? 0) + Number(d.darkred ?? 0));
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <KpiTile label={t("newReports")} value={k.newReports} series={daily} trend={{ value: daily.at(-1)! - (daily.at(-2) ?? 0) }} />
      <KpiTile label={t("highRisk")} value={k.highRisk} series={high} />
      <KpiTile label={t("activeCampaigns")} value={k.activeCampaigns} />
      <KpiTile label={t("awaitingApproval")} value={k.awaitingApproval} />
      <KpiTile label={t("medianTakedown")} value={k.medianTakedownHours === null ? t("noValue") : t("hours", { value: k.medianTakedownHours })} />
    </div>
  );
}

async function Volume() {
  const ctx = await requireRole("soc_analyst");
  const [rows, t, locale] = await Promise.all([getDailyVolume(ctx.supabase), getTranslations("soc.command"), getLocale()]);
  const data: Record<string, string | number>[] = rows.map((r) => ({ ...r, label: fmtDate(String(r.day), locale, "d MMM") }));
  const summary = data.map((r) => `${r.label}: ${["green", "yellow", "orange", "red", "darkred", "grey"].map((f) => `${f} ${r[f]}`).join(", ")}`).join("; ");
  return <FlagStack data={data} summary={t("volumeSr", { summary })} />;
}

async function Activity() {
  const ctx = await requireRole("soc_analyst");
  const [rows, t, te, locale] = await Promise.all([getRecentActivity(ctx.supabase), getTranslations("soc.command"), getTranslations("soc.events"), getLocale()]);
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t("allClear")}</p>;
  return (
    <ol className="space-y-2" aria-live="polite">
      {rows.map((e) => {
        const rep = e.reports as { protocol: string; flag: "red" | null } | null;
        return (
          <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
            {rep?.flag && <FlagBadge flag={rep.flag} />}
            <div className="min-w-0 flex-1">
              <Link href={`/soc/inbox/${e.report_id}`} className="font-mono text-xs hover:underline">{rep?.protocol}</Link>
              <p className="truncate text-sm">{te(e.kind as "created")}{(e.actor as { full_name: string | null } | null)?.full_name ? ` · ${(e.actor as { full_name: string }).full_name}` : ""}</p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.created_at}>{fmtAgo(e.created_at, locale)}</time>
          </li>
        );
      })}
    </ol>
  );
}

async function Attention() {
  const ctx = await requireRole("soc_analyst");
  const [a, t, locale] = await Promise.all([getNeedsAttention(ctx.supabase), getTranslations("soc.command"), getLocale()]);
  const items = [
    ...a.overdue.map((n) => ({ key: n.id, icon: Clock, text: t("overdue", { protocol: n.protocol }), meta: fmtAgo(n.due_at, locale), href: `/soc/takedowns/${n.id}` })),
    ...a.spikes.map((s) => ({ key: s.name, icon: Siren, text: t("spike", { count: s.count, name: s.name }), meta: "", href: "/soc/inbox" })),
    ...(a.unassigned ? [{ key: "u", icon: UserX, text: t("unassigned", { count: a.unassigned }), meta: "", href: "/soc/inbox?assigned=none&flag=red" }] : []),
  ];
  if (!items.length) return <p className="text-sm text-muted-foreground">{t("allClear")}</p>;
  return (
    <ul className="space-y-2">
      {items.map(({ key, icon: Icon, text, meta, href }) => (
        <li key={key}>
          <Link href={href} className="flex items-center gap-3 rounded-lg border border-flag-orange/40 bg-flag-orange/10 p-2.5 text-sm hover:bg-flag-orange/15">
            <Icon className="size-4 shrink-0 text-flag-orange" aria-hidden="true" />
            <span className="flex-1">{text}</span>
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function CommandCentre({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc");
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.command")} />
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <KpiTileSkeleton key={i} />)}</div>}>
        <Kpis />
      </Suspense>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="font-display text-base font-medium">{t("command.volume")}</h2>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}><Volume /></Suspense>
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="inline-flex items-center gap-2 font-display text-base font-medium"><AlertTriangle className="size-4 text-flag-orange" aria-hidden="true" />{t("command.attention")}</h2>
          <Suspense fallback={<Skeleton className="h-40 w-full" />}><Attention /></Suspense>
        </section>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}><HotZonesTile /></Suspense>
      <section className="glass-card space-y-3 rounded-xl p-4">
        <h2 className="inline-flex items-center gap-2 font-display text-base font-medium">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-flag-green" />{t("command.activity")}
        </h2>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}><Activity /></Suspense>
      </section>
    </div>
  );
}
