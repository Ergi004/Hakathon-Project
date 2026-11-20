import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AlertRuleForm, RuleRowActions } from "@/components/soc/alert-rules";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtAgo } from "@/lib/format";
import { guardOrRedirect, requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("alerts") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireRole("soc_lead"));
  const [t, locale] = await Promise.all([getTranslations("soc.alerts"), getLocale()]);
  const [rules, events, inst] = await Promise.all([
    ctx.supabase.from("alert_rules").select("id, name, condition, channel, active").order("name"),
    ctx.supabase.from("alert_events").select("id, value, fired_at, alert_rules(name)").order("fired_at", { ascending: false }).limit(50),
    ctx.supabase.from("institutions").select("name").order("name"),
  ]);
  return (
    <div className="space-y-5">
      <AlertRuleForm institutions={(inst.data ?? []).map((i) => i.name)} />
      <ul className="space-y-2">
        {(rules.data ?? []).map((r) => {
          const c = r.condition as { metric: "reports_per_hour"; op: string; value: number; institution?: string | null };
          return (
            <li key={r.id} className="glass-card flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm">
              <span className="font-medium">{r.name}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{t(`metrics.${c.metric}`)} {c.op} {c.value}{c.institution ? ` · ${c.institution}` : ""}</code>
              <Badge variant="outline">{t(`channels.${r.channel as "in_app"}`)}</Badge>
              <span className="ml-auto"><RuleRowActions id={r.id} active={r.active} name={r.name} /></span>
            </li>
          );
        })}
      </ul>
      <section className="glass-card space-y-2 rounded-xl p-4">
        <h2 className="font-medium">{t("fired")}</h2>
        {!events.data?.length ? <p className="text-sm text-muted-foreground">{t("noneFired")}</p> : (
          <ul className="space-y-1.5 text-sm">
            {events.data.map((e) => (
              <li key={e.id} className="flex justify-between gap-3"><span>{(e.alert_rules as { name: string } | null)?.name} · <span className="font-mono">{e.value}</span></span><time className="text-xs text-muted-foreground">{fmtAgo(e.fired_at, locale)}</time></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("alerts")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
