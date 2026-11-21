import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CalendarDays, Download, FileText, ShieldAlert } from "lucide-react";
import { FlagBadge } from "@/components/flags/flag-badge";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { MaskedText } from "@/components/shared/masked-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { fmtDateTime } from "@/lib/format";
import { nowMs } from "@/lib/time";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { orgInstitutionIds } from "@/server/queries/business";
import { pageCount, pageParam, pageRange } from "@/lib/pagination";
import { Pager } from "@/components/shared/pager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("reports") };
}

const PAGE_SIZE = 20;
type SP = { page?: string };

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const page = pageParam((await searchParams).page);
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security"]));
  const [t, tb, ts, tc, locale] = await Promise.all([getTranslations("biz.reports"), getTranslations("biz"), getTranslations("reportStatus"), getTranslations("channel"), getLocale()]);
  const inst = await orgInstitutionIds(ctx);
  if (!inst.length) return <Card><CardContent><EmptyPanel icon={FileText} title={t("empty")} body={tb("rp.emptyBody")} /></CardContent></Card>;
  // Anonymised: never select reporter_id, reporter_contact or tracking data.
  const base = () => ctx.supabase.from("reports").select("id, campaigns!inner(institution_id)", { count: "exact", head: true }).in("campaigns.institution_id", inst);
  const weekAgo = new Date(nowMs() - 7 * 86_400_000).toISOString();
  const [{ data, count: total }, weekQ, confirmedQ] = await Promise.all([
    ctx.supabase.from("reports").select("id, protocol, status, flag, score, channel, created_at, campaigns!inner(code, institution_id), messages(body_masked)", { count: "exact" }).in("campaigns.institution_id", inst).order("created_at", { ascending: false }).order("id").range(...pageRange(page, PAGE_SIZE)),
    base().gte("created_at", weekAgo),
    base().in("status", ["confirmed", "takedown_requested", "taken_down"]),
  ]);
  const all = data ?? [];
  if (!total) return <Card><CardContent><EmptyPanel icon={FileText} title={t("empty")} body={tb("rp.emptyBody")} /></CardContent></Card>;
  const week = weekQ.count ?? 0;
  const confirmed = confirmedQ.count ?? 0;

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <li><StatCard icon={FileText} label={tb("rp.stats.total")} value={total} /></li>
        <li><StatCard icon={CalendarDays} tone="text-flag-yellow" label={tb("rp.stats.week")} value={week} /></li>
        <li><StatCard icon={ShieldAlert} tone="text-flag-red" label={tb("rp.stats.confirmed")} value={confirmed} /></li>
      </ul>
      <ul className="grid gap-3 xl:grid-cols-2">
        {all.map((r) => {
          const body = (r.messages as { body_masked: string } | null)?.body_masked;
          return (
            <li key={r.id}>
              <Card className="h-full gap-3 py-4">
                <CardContent className="space-y-3 px-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-sm font-semibold">{r.protocol}</span>
                    {r.flag && <FlagBadge flag={r.flag} score={r.score} />}
                    <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5">{ts(r.status)}</span>
                    <span className="ml-auto text-muted-foreground">{fmtDateTime(r.created_at, locale)}</span>
                  </div>
                  {body && <MaskedText text={body} className="line-clamp-3 rounded-lg bg-muted/40 p-3 text-sm" />}
                  <p className="text-xs text-muted-foreground">
                    {tb("rp.campaign")}: <span className="font-mono">{(r.campaigns as { code: string }).code}</span>
                    {r.channel && <> · {tc(r.channel)}</>}
                  </p>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      <Pager page={page} pages={pageCount(total, PAGE_SIZE)} />
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage
      title={t("reports")}
      subtitle={tb("pages.reports")}
      actions={<Button asChild variant="outline" className="rounded-full"><a href="/api/business/export/reports"><Download className="size-4" aria-hidden="true" />CSV</a></Button>}
    >
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
