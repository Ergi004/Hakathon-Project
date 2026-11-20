import { AlertTriangle, CheckCheck, ChevronRight, Clock, Flag, Gavel, Inbox, Search, ShieldAlert, Siren, Stamp, Timer, UserX } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { FlagStack } from "@/components/charts/flag-stack";
import { DashPage, EmptyPanel, Panel, StatCard } from "@/components/layout/dash";
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
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
      <li><StatCard icon={Inbox} label={t("newReports")} value={k.newReports} series={daily} /></li>
      <li><StatCard icon={ShieldAlert} tone="text-flag-red" label={t("highRisk")} value={k.highRisk} series={high} /></li>
      <li><StatCard icon={Flag} tone="text-flag-orange" label={t("activeCampaigns")} value={k.activeCampaigns} /></li>
      <li><StatCard icon={Stamp} tone="text-flag-yellow" label={t("awaitingApproval")} value={k.awaitingApproval} /></li>
      <li><StatCard icon={Timer} label={t("medianTakedown")} value={k.medianTakedownHours === null ? t("noValue") : t("hours", { value: k.medianTakedownHours })} /></li>
    </ul>
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
  if (!rows.length) return <EmptyPanel icon={CheckCheck} tone="text-flag-green" title={t("allClear")} />;
  return (
    <ol className="divide-y divide-border" aria-live="polite">
      {rows.map((e) => {
        const rep = e.reports as { protocol: string; flag: "red" | null } | null;
        return (
          <li key={e.id} className="flex items-center gap-3 px-5 py-3">
            {rep?.flag && <FlagBadge flag={rep.flag} />}
            <div className="min-w-0 flex-1">
              <Link href={`/soc/inbox/${e.report_id}`} className="font-mono text-xs text-primary hover:underline">{rep?.protocol}</Link>
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
  if (!items.length) return <EmptyPanel icon={CheckCheck} tone="text-flag-green" title={t("allClear")} />;
  return (
    <ul className="-mr-2 max-h-[22rem] space-y-2 overflow-y-auto pr-2">
      {items.map(({ key, icon: Icon, text, meta, href }) => (
        <li key={key}>
          <Link href={href} className="group flex items-center gap-3 rounded-xl border border-l-4 border-flag-orange/30 border-l-flag-orange bg-flag-orange/5 p-3 text-sm transition-colors hover:bg-flag-orange/10">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-flag-orange/15"><Icon className="size-4 text-flag-orange" aria-hidden="true" /></span>
            <span className="flex-1 font-medium">{text}</span>
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function CommandCentre({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc"), getTranslations("socx")]);
  const quick = [
    { href: "/soc/inbox?flag=red", label: t("nav.inbox"), Icon: Inbox },
    { href: "/soc/campaigns", label: t("nav.campaigns"), Icon: Flag },
    { href: "/soc/takedowns", label: t("nav.takedowns"), Icon: Gavel },
    { href: "/soc/search", label: t("nav.search"), Icon: Search },
  ];
  return (
    <DashPage title={t("nav.command")} subtitle={tx("pages.command")}>
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}>
        <Kpis />
      </Suspense>
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title={t("command.volume")} description={tx("cmd.volumeHint")}>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}><Volume /></Suspense>
        </Panel>
        <Panel title={t("command.attention")} icon={AlertTriangle} iconTone="text-flag-orange">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}><Attention /></Suspense>
        </Panel>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Panel
          flush
          className="xl:col-span-2"
          title={<><span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-flag-green" />{t("command.activity")}</>}
          action={<span className="rounded-full border border-flag-green/40 px-2 py-0.5 text-xs text-flag-green">{tx("cmd.live")}</span>}
        >
          <Suspense fallback={<Skeleton className="m-5 h-64" />}><Activity /></Suspense>
        </Panel>
        <section aria-labelledby="soc-quick" className="space-y-3">
          <h2 id="soc-quick" className="font-display text-lg font-medium">{tx("quick")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
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
      </div>
    </DashPage>
  );
}
