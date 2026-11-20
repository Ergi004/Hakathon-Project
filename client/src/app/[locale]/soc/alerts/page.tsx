import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { BellRing, CheckCheck, ListChecks, Siren } from "lucide-react";
import { DashPage, EmptyPanel, Panel, StatCard } from "@/components/layout/dash";
import { AlertRuleForm, RuleRowActions } from "@/components/soc/alert-rules";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { guardOrRedirect, requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("alerts") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireRole("soc_lead"));
  const [t, tx, locale] = await Promise.all([getTranslations("soc.alerts"), getTranslations("socx"), getLocale()]);
  const [rules, events, inst] = await Promise.all([
    ctx.supabase.from("alert_rules").select("id, name, condition, channel, active").order("name"),
    ctx.supabase.from("alert_events").select("id, value, fired_at, alert_rules(name)").order("fired_at", { ascending: false }).limit(50),
    ctx.supabase.from("institutions").select("name").order("name"),
  ]);
  const list = rules.data ?? [];
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-3 gap-3">
        <li><StatCard icon={ListChecks} label={tx("al.rules")} value={list.length} /></li>
        <li><StatCard icon={BellRing} tone="text-flag-green" label={tx("al.active")} value={list.filter((r) => r.active).length} /></li>
        <li><StatCard icon={Siren} tone="text-flag-orange" label={tx("al.fired")} value={events.data?.length ?? 0} /></li>
      </ul>
      <AlertRuleForm institutions={(inst.data ?? []).map((i) => i.name)} />
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Panel flush className="xl:col-span-2" title={tx("al.list")}>
          {!list.length ? <EmptyPanel icon={ListChecks} title={tx("al.noRules")} /> : (
            <ul className="divide-y divide-border">
              {list.map((r) => {
                const c = r.condition as { metric: "reports_per_hour"; op: string; value: number; institution?: string | null };
                return (
                  <li key={r.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-4 text-sm", !r.active && "opacity-60")}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><BellRing className="size-4" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{t(`metrics.${c.metric}`)} {c.op} {c.value}</code>
                        {c.institution && <span>{c.institution}</span>}
                        <span className="rounded-full border border-border px-2 py-0.5">{t(`channels.${r.channel as "in_app"}`)}</span>
                      </p>
                    </div>
                    <RuleRowActions id={r.id} active={r.active} name={r.name} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel flush title={t("fired")} icon={Siren} iconTone="text-flag-orange">
          {!events.data?.length ? <EmptyPanel icon={CheckCheck} tone="text-flag-green" title={t("noneFired")} /> : (
            <ol className="divide-y divide-border">
              {events.data.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate">{(e.alert_rules as { name: string } | null)?.name}</span>
                  <span className="font-mono font-medium tabular-nums">{e.value}</span>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={e.fired_at}>{fmtAgo(e.fired_at, locale)}</time>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("alerts")} subtitle={tx("pages.alerts")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
