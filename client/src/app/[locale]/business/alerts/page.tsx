import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { AlertActions } from "@/components/business/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { DefangedText } from "@/components/shared/defanged-text";
import { SeverityDot } from "@/components/shared/severity-dot";
import { UrlSelect } from "@/components/shared/url-select";
import { Badge } from "@/components/ui/badge";
import { fmtAgo, fmtDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("alerts") };
}

async function Content({ searchParams }: { searchParams: Promise<{ severity?: string; status?: string }> }) {
  const sp = await searchParams;
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security"]));
  const [t, ts, td, tu, locale] = await Promise.all([getTranslations("biz.alerts"), getTranslations("severity"), getTranslations("soc.domains"), getTranslations("ui"), getLocale()]);
  let q = ctx.supabase.from("brand_alerts").select("id, title, severity, status, created_at, domains(domain, registrar, hosting_country, age_days, registered_at, class), campaigns(code)").eq("org_id", ctx.org.id).order("created_at", { ascending: false }).limit(200);
  if (["low", "medium", "high", "critical"].includes(sp.severity ?? "")) q = q.eq("severity", sp.severity as "low");
  if (["new", "acknowledged", "escalated", "resolved"].includes(sp.status ?? "")) q = q.eq("status", sp.status!);
  const { data } = await q;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <UrlSelect name="severity" label={t("severity")} anyLabel={tu("all")} options={(["critical", "high", "medium", "low"] as const).map((s) => ({ value: s, label: ts(s) }))} />
        <UrlSelect name="status" label={t("status")} anyLabel={tu("all")} options={(["new", "acknowledged", "escalated", "resolved"] as const).map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      </div>
      {!data?.length ? <EmptyState title={t("empty")} /> : (
        <ul className="space-y-3">
          {data.map((a) => {
            const d = a.domains as { domain: string; registrar: string | null; hosting_country: string | null; age_days: number | null; registered_at: string | null; class: string } | null;
            return (
              <li key={a.id} className="glass-card space-y-3 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2"><SeverityDot severity={a.severity} /><Badge variant="outline">{t(`statuses.${a.status as "new"}`)}</Badge><span className="font-medium">{a.title}</span><span className="ml-auto text-xs text-muted-foreground">{fmtAgo(a.created_at, locale)}</span></div>
                {d && (
                  <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">{t("evidence")}</summary>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      <dt className="text-muted-foreground">{td("domain")}</dt><dd><DefangedText value={d.domain} /></dd>
                      <dt className="text-muted-foreground">{td("registrar")}</dt><dd>{d.registrar ?? "—"}</dd>
                      <dt className="text-muted-foreground">{td("hosting")}</dt><dd>{d.hosting_country ?? "—"}</dd>
                      <dt className="text-muted-foreground">{td("age")}</dt><dd>{d.registered_at ? fmtDate(d.registered_at, locale) : "—"}{d.age_days !== null ? ` · ${td("ageDays", { count: d.age_days })}` : ""}</dd>
                    </dl>
                  </details>
                )}
                <AlertActions id={a.id} status={a.status} canAct />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ severity?: string; status?: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("alerts")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content searchParams={searchParams} /></Suspense>
    </div>
  );
}
