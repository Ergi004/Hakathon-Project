import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CircleCheck, Eye, Globe, Info, ShieldAlert } from "lucide-react";
import { DomainActions } from "@/components/business/forms";
import { IntelCell } from "@/components/intel/intel-cell";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { UrlToggle } from "@/components/shared/url-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { latestVerdicts } from "@/server/intel/staff-view";

const STATUS_TONE: Record<string, string> = {
  threat: "border-flag-red/40 bg-flag-red/10",
  watching: "border-flag-yellow/40 bg-flag-yellow/10",
  taken_down: "border-flag-green/40 bg-flag-green/10",
  allowlisted: "border-primary/40 bg-primary/10",
  dismissed: "border-border bg-muted text-muted-foreground",
};
const riskTone = (r: number) => (r >= 80 ? "bg-flag-darkred" : r >= 60 ? "bg-flag-red" : r >= 40 ? "bg-flag-orange" : r >= 20 ? "bg-flag-yellow" : "bg-flag-green");

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("domains") };
}

async function Content({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security"]));
  const [t, tb, td, tc] = await Promise.all([getTranslations("biz.domains"), getTranslations("biz"), getTranslations("soc.domains"), getTranslations("domainClass")]);
  const { data } = await ctx.supabase.from("domains").select("id, domain, class, age_days, registrar, hosting_country, risk_score, status").order("risk_score", { ascending: false, nullsFirst: false }).limit(500);
  const all = data ?? [];
  if (!all.length) return <Card><CardContent><EmptyPanel icon={Globe} title={t("empty")} /></CardContent></Card>;
  const view = ["threat", "watching", "allowlisted"].includes(show ?? "") ? show : "all";
  const shown = view === "all" ? all : all.filter((d) => d.status === view);
  const n = (s: string) => all.filter((d) => d.status === s).length;
  // Live threat intelligence (read-only for businesses): latest verdict, domain age, subdomains.
  const [intel, ti] = await Promise.all([latestVerdicts(ctx.supabase, shown.map((d) => d.domain)), getTranslations("intel")]);

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <li><StatCard icon={Globe} label={tb("dm.stats.total")} value={all.length} /></li>
        <li><StatCard icon={ShieldAlert} tone="text-flag-red" label={tb("dm.stats.threat")} value={n("threat")} /></li>
        <li><StatCard icon={Eye} tone="text-flag-yellow" label={tb("dm.stats.watching")} value={n("watching")} /></li>
        <li><StatCard icon={CircleCheck} tone="text-flag-green" label={tb("dm.stats.takenDown")} value={n("taken_down")} /></li>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UrlToggle name="show" label={tb("dm.filter")} options={(["all", "threat", "watching", "allowlisted"] as const).map((f) => ({ value: f, label: tb(`dm.filters.${f}`) }))} />
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Info className="size-4" aria-hidden="true" />{t("allowlistHint")}</p>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {!shown.length ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{tb("dm.noneInFilter")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-5">{td("domain")}</TableHead>
                  <TableHead>{td("risk")}</TableHead>
                  <TableHead>{td("class")}</TableHead>
                  <TableHead className="hidden md:table-cell">{td("age")}</TableHead>
                  <TableHead className="hidden xl:table-cell">{td("registrar")}</TableHead>
                  <TableHead className="hidden xl:table-cell">{td("hosting")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{ti("latest")}</TableHead>
                  <TableHead>{td("status")}</TableHead>
                  <TableHead className="pr-5"><span className="sr-only">{td("status")}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="pl-5 font-mono text-sm">{d.domain.replace(/\./g, "[.]")}</TableCell>
                    <TableCell>
                      {d.risk_score === null ? "—" : (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className={cn("block h-full rounded-full", riskTone(d.risk_score))} style={{ width: `${d.risk_score}%` }} /></span>
                          <span className="font-mono text-xs tabular-nums">{d.risk_score}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{tc(d.class)}</Badge></TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{d.age_days !== null ? td("ageDays", { count: d.age_days }) : "—"}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">{d.registrar ?? "—"}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">{d.hosting_country ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell"><IntelCell v={intel.get(d.domain)} /></TableCell>
                    <TableCell><span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_TONE[d.status] ?? "border-border")}>{td(`statuses.${d.status as "threat"}`)}</span></TableCell>
                    <TableCell className="pr-5"><div className="flex justify-end"><DomainActions id={d.id} status={d.status} /></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ show?: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("domains")} subtitle={tb("pages.domains")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
