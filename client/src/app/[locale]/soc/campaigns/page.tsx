import { CheckCheck, Download, Eye, Flag, Gavel, Globe, LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { CampaignCard } from "@/components/shared/campaign-card";
import { SeverityDot } from "@/components/shared/severity-dot";
import { UrlSearch } from "@/components/shared/url-search";
import { UrlSelect } from "@/components/shared/url-select";
import { CreateCampaignDialog, MergeDialog } from "@/components/soc/campaign-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckAggregates } from "@/components/shared/check-aggregates";
import { Link } from "@/i18n/navigation";
import { fmtDate } from "@/lib/format";
import { asBrandCategory, asScamType } from "@/lib/pattern-labels";
import { requireRole } from "@/server/auth";
import { Pager } from "@/components/shared/pager";
import { pageParam } from "@/lib/pagination";
import { CAMPAIGN_STATUSES, getCampaignOptions, getCampaignPatternMap, getCampaignStatusCounts, getCampaigns } from "@/server/queries/soc";

type Search = Promise<{ status?: string; q?: string; view?: string; page?: string }>;
const STATUS = CAMPAIGN_STATUSES;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("campaigns") };
}

async function Toolbar() {
  const ctx = await requireRole("soc_analyst");
  const [inst, camps, t, tu, ts] = await Promise.all([
    ctx.supabase.from("institutions").select("id, name").order("name"),
    getCampaignOptions(ctx.supabase),
    getTranslations("soc.campaigns"),
    getTranslations("ui"),
    getTranslations("campaignStatus"),
  ]);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end [&_button[role=combobox]]:sm:w-52">
        <UrlSearch label={tu("search")} className="sm:w-72" />
        <UrlSelect name="status" label={t("status")} anyLabel={tu("all")} options={STATUS.map((s) => ({ value: s, label: ts(s) }))} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-full"><a href="/api/soc/export/campaigns"><Download className="size-3.5" aria-hidden="true" />{tu("exportCsv")}</a></Button>
        <MergeDialog campaigns={camps} />
        <CreateCampaignDialog institutions={inst.data ?? []} />
      </div>
    </div>
  );
}

const STAT_ICON = { monitoring: Eye, confirmed: Flag, takedown_in_progress: Gavel, resolved: CheckCheck } as const;
const STAT_TONE = { monitoring: "text-flag-yellow", confirmed: "text-flag-orange", takedown_in_progress: "text-primary", resolved: "text-flag-green" } as const;

async function Stats() {
  const ctx = await requireRole("soc_analyst");
  const [counts, ts] = await Promise.all([getCampaignStatusCounts(ctx.supabase), getTranslations("campaignStatus")]);
  return (
    <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {STATUS.map((s) => <li key={s}><StatCard icon={STAT_ICON[s]} tone={STAT_TONE[s]} label={ts(s)} value={counts[s]} /></li>)}
    </ul>
  );
}

async function List_({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const status = STATUS.find((s) => s === sp.status);
  const [t, tx, ts, tScam, tBrand, locale, list] = await Promise.all([
    getTranslations("soc.campaigns"),
    getTranslations("socx"),
    getTranslations("campaignStatus"),
    getTranslations("scamType"),
    getTranslations("brandCategory"),
    getLocale(),
    getCampaigns(ctx.supabase, { status, q: sp.q?.slice(0, 100), page: pageParam(sp.page) }),
  ]);
  const rows = list.rows;
  const patterns = await getCampaignPatternMap(ctx.supabase, rows.map((c) => c.id));
  const view = sp.view === "grid" ? "grid" : "table";
  const toggle = (
    <div className="flex items-center justify-between gap-3">
    <span className="text-sm text-muted-foreground tabular-nums">{tx("results", { count: list.total })}</span>
    <div className="flex gap-1 rounded-full bg-muted p-1" role="group">
      <Button asChild size="sm" variant={view === "table" ? "secondary" : "ghost"} className="rounded-full"><Link href={`/soc/campaigns?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.q ? { q: sp.q } : {}), view: "table" })}`}><List className="size-4" aria-hidden="true" />{t("table")}</Link></Button>
      <Button asChild size="sm" variant={view === "grid" ? "secondary" : "ghost"} className="rounded-full"><Link href={`/soc/campaigns?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.q ? { q: sp.q } : {}), view: "grid" })}`}><LayoutGrid className="size-4" aria-hidden="true" />{t("grid")}</Link></Button>
    </div>
    </div>
  );
  if (!rows.length) return <div className="space-y-3">{toggle}<div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Flag} title={t("empty")} /></div></div>;
  return (
    <div className="space-y-3">
      {toggle}
      {view === "grid" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((c) => {
            const pattern = patterns.get(c.id);
            const scamKey = asScamType(pattern?.scamType);
            const brandKey = asBrandCategory(pattern?.brand);
            return (
              <li key={c.id}>
                <CampaignCard c={{ ...c, imitated_name: c.imitated_name ?? (c.institutions as { name: string } | null)?.name ?? null }} href={`/soc/campaigns/${c.id}`} />
                {pattern && (
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {scamKey && <span>{tScam(scamKey)}</span>}
                    {brandKey && <span>{tBrand(brandKey)}</span>}
                    <span>{t("patternSizeCount", { count: pattern.size })}</span>
                    <span>{t("firstSeen")} {fmtDate(pattern.firstSeen, locale)}</span>
                    <span>{t("lastSeen")} {fmtDate(pattern.lastSeen, locale)}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t("code")}</TableHead><TableHead>{t("institution")}</TableHead><TableHead className="hidden md:table-cell">{t("tactic")}</TableHead>
              <TableHead className="hidden xl:table-cell">{t("scamType")}</TableHead><TableHead className="hidden xl:table-cell">{t("brand")}</TableHead>
              <TableHead>{t("status")}</TableHead><TableHead>{t("severity")}</TableHead><TableHead className="text-right">{t("count")}</TableHead>
              <TableHead className="hidden text-right lg:table-cell">{t("patternSize")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("owner")}</TableHead>
              <TableHead className="hidden xl:table-cell">{t("firstSeen")}</TableHead><TableHead className="hidden md:table-cell">{t("lastSeen")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((c) => {
                const pattern = patterns.get(c.id);
                const scamKey = asScamType(pattern?.scamType);
                const brandKey = asBrandCategory(pattern?.brand);
                return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs"><Link className="font-medium text-primary hover:underline" href={`/soc/campaigns/${c.id}`}>{c.code}</Link>{c.is_public && <Globe className="ml-1 inline size-3 text-primary" aria-label={t("public")} />}</TableCell>
                  <TableCell className="text-xs">{(c.institutions as { name: string } | null)?.name ?? c.imitated_name ?? "—"}</TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{c.tactic.replace(/_/g, " ")}</TableCell>
                  <TableCell className="hidden text-xs xl:table-cell">{scamKey ? tScam(scamKey) : "—"}</TableCell>
                  <TableCell className="hidden text-xs xl:table-cell">{brandKey ? tBrand(brandKey) : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="whitespace-nowrap">{ts(c.status)}</Badge></TableCell>
                  <TableCell><SeverityDot severity={c.severity} /></TableCell>
                  <TableCell className="text-right tabular-nums">{c.message_count}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{pattern ? pattern.size : "—"}</TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{(c.owner as { full_name: string | null } | null)?.full_name ?? "—"}</TableCell>
                  <TableCell className="hidden text-xs xl:table-cell">{fmtDate(pattern?.firstSeen ?? c.first_seen, locale)}</TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{fmtDate(pattern?.lastSeen ?? c.last_seen, locale)}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={list.page} pages={list.pages} />
    </div>
  );
}

export default async function CampaignsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("campaigns")} subtitle={tx("pages.campaigns")}>
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}><Stats /></Suspense>
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}><CheckAggregates /></Suspense>
      <Suspense fallback={<Skeleton className="h-20 w-full rounded-xl" />}><Toolbar /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><List_ searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
