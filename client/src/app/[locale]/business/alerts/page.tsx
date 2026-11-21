import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { BellRing, CheckCheck, Eye, Send, ShieldCheck } from "lucide-react";
import { AlertActions } from "@/components/business/forms";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { DefangedText } from "@/components/shared/defanged-text";
import { SeverityDot } from "@/components/shared/severity-dot";
import { UrlSelect } from "@/components/shared/url-select";
import { UrlToggle } from "@/components/shared/url-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { fmtAgo, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pageCount, pageParam, pageRange } from "@/lib/pagination";
import { Pager } from "@/components/shared/pager";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";

const STATUSES = ["new", "acknowledged", "escalated", "resolved"] as const;
const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const SEV_EDGE: Record<string, string> = { critical: "border-l-flag-darkred", high: "border-l-flag-red", medium: "border-l-flag-orange", low: "border-l-flag-yellow" };
const STATUS_TONE: Record<string, string> = {
  new: "border-primary/40 bg-primary/10 text-primary",
  acknowledged: "border-flag-yellow/40 bg-flag-yellow/10",
  escalated: "border-flag-orange/40 bg-flag-orange/10",
  resolved: "border-flag-green/40 bg-flag-green/10",
};

type SP = { severity?: string; status?: string; page?: string };
const PAGE_SIZE = 15;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("alerts") };
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security"]));
  const [t, tb, ts, td, tu, locale] = await Promise.all([getTranslations("biz.alerts"), getTranslations("biz"), getTranslations("severity"), getTranslations("soc.domains"), getTranslations("ui"), getLocale()]);
  const status = STATUSES.includes(sp.status as "new") ? sp.status : undefined;
  const severity = SEVERITIES.includes(sp.severity as "low") ? sp.severity : undefined;
  const page = pageParam(sp.page);
  // Filters run in the query so every page is correct; the stat cards count the whole org.
  let q = ctx.supabase
    .from("brand_alerts")
    .select("id, title, severity, status, created_at, domains(domain, registrar, hosting_country, age_days, registered_at, class), campaigns(code)", { count: "exact" })
    .eq("org_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .range(...pageRange(page, PAGE_SIZE));
  if (status) q = q.eq("status", status);
  if (severity) q = q.eq("severity", severity as "low");
  const counts = await Promise.all(STATUSES.map((s) => ctx.supabase.from("brand_alerts").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id).eq("status", s)));
  const { data, count: total } = await q;
  const shown = data ?? [];
  const byStatus = new Map(STATUSES.map((s, i) => [s, counts[i].count ?? 0]));
  const orgTotal = [...byStatus.values()].reduce((a, b) => a + b, 0);
  const count = (s: string) => byStatus.get(s as "new") ?? 0;
  const statIcon = { new: BellRing, acknowledged: Eye, escalated: Send, resolved: CheckCheck } as const;
  const statTone = { new: "text-primary", acknowledged: "text-flag-yellow", escalated: "text-flag-orange", resolved: "text-flag-green" } as const;

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {STATUSES.map((s) => (
          <li key={s}><StatCard icon={statIcon[s]} tone={statTone[s]} label={tb(`al.stats.${s}`)} value={count(s)} /></li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-4">
        <UrlToggle name="status" label={tb("al.filterStatus")} options={[{ value: "all", label: tu("all") }, ...STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))]} />
        <div className="w-48">
          <UrlSelect name="severity" label={t("severity")} anyLabel={tu("all")} options={SEVERITIES.map((s) => ({ value: s, label: ts(s) }))} />
        </div>
      </div>

      {!shown.length ? (
        <Card><CardContent><EmptyPanel icon={ShieldCheck} tone="text-flag-green" title={t("empty")} body={orgTotal ? undefined : tb("al.emptyBody")} /></CardContent></Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => {
            const d = a.domains as { domain: string; registrar: string | null; hosting_country: string | null; age_days: number | null; registered_at: string | null; class: string } | null;
            const code = (a.campaigns as { code: string } | null)?.code;
            return (
              <li key={a.id}>
                <Card className={cn("gap-4 border-l-4 py-5", SEV_EDGE[a.severity] ?? "border-l-border", a.status === "resolved" && "opacity-75")}>
                  <CardContent className="space-y-4 px-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityDot severity={a.severity} />
                          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_TONE[a.status])}>{t(`statuses.${a.status as "new"}`)}</span>
                          {code && <span className="font-mono text-xs text-muted-foreground">{tb("al.campaign", { code })}</span>}
                        </div>
                        <p className="font-display text-lg leading-snug font-medium">{a.title}</p>
                      </div>
                      <time dateTime={a.created_at} className="text-xs text-muted-foreground">{fmtAgo(a.created_at, locale)}</time>
                    </div>

                    {d && (
                      <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0"><dt className="text-xs text-muted-foreground">{td("domain")}</dt><dd className="mt-0.5"><DefangedText value={d.domain} /></dd></div>
                        <div><dt className="text-xs text-muted-foreground">{td("registrar")}</dt><dd className="mt-0.5">{d.registrar ?? "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">{td("hosting")}</dt><dd className="mt-0.5">{d.hosting_country ?? "—"}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">{td("age")}</dt><dd className="mt-0.5">{d.registered_at ? fmtDate(d.registered_at, locale) : "—"}{d.age_days !== null ? ` · ${td("ageDays", { count: d.age_days })}` : ""}</dd></div>
                      </dl>
                    )}

                    <AlertActions id={a.id} status={a.status} canAct />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} pages={pageCount(total, PAGE_SIZE)} />
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("alerts")} subtitle={tb("pages.alerts")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
