import { Activity, Download, Flag, Globe, Grid3x3, LayoutGrid, List, Swords, TrendingUp, X } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CampaignActivity } from "@/components/charts/campaign-activity";
import { DashPage, EmptyPanel, Panel } from "@/components/layout/dash";
import { CampaignCard } from "@/components/shared/campaign-card";
import { CampaignStatusBadge } from "@/components/shared/campaign-status";
import { CheckAggregates } from "@/components/shared/check-aggregates";
import { Pager } from "@/components/shared/pager";
import { SeverityDot } from "@/components/shared/severity-dot";
import { UrlSearch } from "@/components/shared/url-search";
import { UrlSelect } from "@/components/shared/url-select";
import { CreateCampaignDialog, MergeDialog } from "@/components/soc/campaign-controls";
import { hrefWith, RankedBars, SeverityMatrix, StatusPipeline } from "@/components/soc/campaign-insights";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { fmtAgo, fmtDate } from "@/lib/format";
import { pageParam } from "@/lib/pagination";
import { asBrandCategory, asScamType } from "@/lib/pattern-labels";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import {
  CAMPAIGN_SEVERITIES,
  CAMPAIGN_SORTS,
  CAMPAIGN_STATUSES,
  getCampaignOptions,
  getCampaignOverview,
  getCampaignPatternMap,
  getCampaigns,
  getCampaignStatusCounts,
  type CampaignFilters,
} from "@/server/queries/soc";

type SP = { status?: string; severity?: string; tactic?: string; inst?: string; active?: string; sort?: string; q?: string; view?: string; page?: string };
type Search = Promise<SP>;

const BASE = "/soc/campaigns";
const ACTIVE_DAYS = ["7", "30", "90"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEVERITY_STRIPE = { critical: "before:bg-flag-darkred", high: "before:bg-flag-red", medium: "before:bg-flag-orange", low: "before:bg-flag-yellow" } as const;

function pick<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** URL → validated filters. Unknown values are ignored rather than trusted. */
function parse(sp: SP): CampaignFilters {
  return {
    status: pick(sp.status, CAMPAIGN_STATUSES),
    severity: pick(sp.severity, CAMPAIGN_SEVERITIES),
    tactic: sp.tactic?.slice(0, 80) || undefined,
    institutionId: sp.inst && UUID.test(sp.inst) ? sp.inst : undefined,
    activeDays: pick(sp.active, ACTIVE_DAYS) ? Number(sp.active) : undefined,
    sort: pick(sp.sort, CAMPAIGN_SORTS),
    q: sp.q?.slice(0, 100) || undefined,
    page: pageParam(sp.page),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("campaigns") };
}

async function Actions() {
  const ctx = await requireRole("soc_analyst");
  const [inst, camps, tu] = await Promise.all([
    ctx.supabase.from("institutions").select("id, name").order("name"),
    getCampaignOptions(ctx.supabase),
    getTranslations("ui"),
  ]);
  return (
    <>
      <Button asChild variant="outline" className="rounded-full"><a href="/api/soc/export/campaigns"><Download className="size-4" aria-hidden="true" />{tu("exportCsv")}</a></Button>
      <MergeDialog campaigns={camps} />
      <CreateCampaignDialog institutions={inst.data ?? []} />
    </>
  );
}

async function Pipeline({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const counts = await getCampaignStatusCounts(ctx.supabase);
  return <StatusPipeline counts={counts} active={pick(sp.status, CAMPAIGN_STATUSES)} href={(status) => hrefWith(BASE, sp, { status })} />;
}

async function Insights({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [o, t, locale] = await Promise.all([getCampaignOverview(ctx.supabase), getTranslations("soc.campaigns"), getLocale()]);
  const weekly = o.weekly.map((w) => ({ label: fmtDate(w.week, locale, "d MMM"), reports: w.reports, campaigns: w.campaigns }));
  const summary = o.weekly.map((w) => t("srWeek", { week: fmtDate(w.week, locale), reports: w.reports, campaigns: w.campaigns })).join("; ");
  const totalReports = o.weekly.reduce((s, w) => s + w.reports, 0);
  const totalNew = o.weekly.reduce((s, w) => s + w.campaigns, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel
        className="xl:col-span-2"
        title={t("activity")}
        icon={Activity}
        description={t("activityHint", { reports: totalReports, campaigns: totalNew })}
      >
        {weekly.length ? <CampaignActivity data={weekly} labels={{ reports: t("activityReports"), campaigns: t("activityNew") }} summary={summary} /> : <EmptyPanel icon={Activity} title={t("noActivity")} />}
      </Panel>

      <Panel title={t("topActive")} icon={TrendingUp} iconTone="text-flag-red" description={t("topActiveHint")}>
        <RankedBars
          empty={t("topEmpty")}
          barClass="bg-flag-red/70"
          rows={o.top.map((c) => ({
            key: c.id,
            href: `${BASE}/${c.id}`,
            label: <><span className="font-mono text-xs text-muted-foreground">{c.code}</span> <span className="font-medium">{c.name ?? "—"}</span></>,
            meta: <SeverityDot severity={c.severity} />,
            value: c.n,
            valueLabel: t("reportsCount", { count: c.n }),
          }))}
        />
      </Panel>

      <Panel className="xl:col-span-2" title={t("matrix")} icon={Grid3x3} description={t("matrixHint")}>
        {o.matrix.length ? (
          <SeverityMatrix cells={o.matrix} href={(severity, status) => hrefWith(BASE, sp, { severity, status })} />
        ) : <EmptyPanel icon={Grid3x3} title={t("empty")} />}
      </Panel>

      <Panel title={t("tactics")} icon={Swords} iconTone="text-chart-5" description={t("tacticsHint")}>
        <RankedBars
          empty={t("empty")}
          barClass="bg-chart-5"
          rows={o.tactics.slice(0, 8).map((x) => ({
            key: x.name,
            href: hrefWith(BASE, sp, { tactic: sp.tactic === x.name ? undefined : x.name }),
            label: <span className={cn("capitalize", sp.tactic === x.name && "font-semibold text-primary")}>{x.name.replace(/_/g, " ")}</span>,
            value: x.campaigns,
            valueLabel: t("tacticValue", { campaigns: x.campaigns, messages: x.messages }),
          }))}
        />
      </Panel>
    </div>
  );
}

async function Filters({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [inst, o, t, tu, ts, tsv] = await Promise.all([
    ctx.supabase.from("institutions").select("id, name").order("name"),
    getCampaignOverview(ctx.supabase),
    getTranslations("soc.campaigns"),
    getTranslations("ui"),
    getTranslations("campaignStatus"),
    getTranslations("severity"),
  ]);
  const f = parse(sp);
  const instName = (inst.data ?? []).find((i) => i.id === f.institutionId)?.name;
  const chips: { key: keyof SP; label: string }[] = [
    f.q ? { key: "q", label: `“${f.q}”` } : null,
    f.status ? { key: "status", label: ts(f.status) } : null,
    f.severity ? { key: "severity", label: tsv(f.severity) } : null,
    f.tactic ? { key: "tactic", label: f.tactic.replace(/_/g, " ") } : null,
    instName ? { key: "inst", label: instName } : null,
    f.activeDays ? { key: "active", label: t(`activeIn.${f.activeDays as 7}`) } : null,
  ].filter((x): x is { key: keyof SP; label: string } => !!x);

  return (
    <section aria-label={tu("filters")} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 2xl:items-end [&_button[role=combobox]]:w-full">
        <UrlSearch label={tu("search")} className="sm:col-span-2 lg:col-span-4 2xl:col-span-1" />
        <UrlSelect name="status" label={t("status")} anyLabel={tu("all")} options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: ts(s) }))} />
        <UrlSelect name="severity" label={t("severity")} anyLabel={tu("all")} options={CAMPAIGN_SEVERITIES.map((s) => ({ value: s, label: tsv(s) }))} />
        <UrlSelect name="tactic" label={t("tactic")} anyLabel={tu("all")} options={o.tactics.map((x) => ({ value: x.name, label: x.name.replace(/_/g, " ") }))} />
        <UrlSelect name="inst" label={t("institution")} anyLabel={tu("all")} options={(inst.data ?? []).map((i) => ({ value: i.id, label: i.name }))} />
        <UrlSelect name="active" label={t("activeLabel")} anyLabel={t("activeAny")} options={ACTIVE_DAYS.map((d) => ({ value: d, label: t(`activeIn.${d}`) }))} />
        <UrlSelect name="sort" label={t("sortLabel")} anyLabel={t("sorts.recent")} options={CAMPAIGN_SORTS.filter((s) => s !== "recent").map((s) => ({ value: s, label: t(`sorts.${s}`) }))} />
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {chips.map((c) => (
            <Link
              key={c.key}
              href={hrefWith(BASE, sp, { [c.key]: undefined })}
              scroll={false}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium capitalize hover:bg-primary/10"
            >
              {c.label}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">{t("removeFilter")}</span>
            </Link>
          ))}
          <Link href={sp.view ? `${BASE}?view=${sp.view}` : BASE} scroll={false} className="ml-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t("clearFilters")}
          </Link>
        </div>
      )}
    </section>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const f = parse(sp);
  const [t, tx, tScam, tBrand, locale, list] = await Promise.all([
    getTranslations("soc.campaigns"),
    getTranslations("socx"),
    getTranslations("scamType"),
    getTranslations("brandCategory"),
    getLocale(),
    getCampaigns(ctx.supabase, f),
  ]);
  const rows = list.rows;
  const patterns = await getCampaignPatternMap(ctx.supabase, rows.map((c) => c.id));
  const view = sp.view === "grid" ? "grid" : "table";
  const maxVolume = Math.max(1, ...rows.map((c) => c.message_count));

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">{tx("results", { count: list.total })}</span>
      <div className="flex gap-1 rounded-full bg-muted p-1" role="group" aria-label={t("viewLabel")}>
        <Button asChild size="sm" variant={view === "table" ? "secondary" : "ghost"} className="rounded-full"><Link href={hrefWith(BASE, sp, { view: undefined })} scroll={false} aria-current={view === "table" ? "true" : undefined}><List className="size-4" aria-hidden="true" />{t("table")}</Link></Button>
        <Button asChild size="sm" variant={view === "grid" ? "secondary" : "ghost"} className="rounded-full"><Link href={hrefWith(BASE, sp, { view: "grid" })} scroll={false} aria-current={view === "grid" ? "true" : undefined}><LayoutGrid className="size-4" aria-hidden="true" />{t("grid")}</Link></Button>
      </div>
    </div>
  );

  if (!rows.length) {
    return (
      <div className="space-y-3">
        {toolbar}
        <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Flag} title={t("empty")} body={list.total === 0 && Object.values(sp).some(Boolean) ? t("emptyFiltered") : undefined} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {view === "grid" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((c) => {
            const pattern = patterns.get(c.id);
            const scamKey = asScamType(pattern?.scamType);
            const brandKey = asBrandCategory(pattern?.brand);
            return (
              <li key={c.id} className="flex flex-col gap-2">
                <CampaignCard c={{ ...c, imitated_name: c.imitated_name ?? (c.institutions as { name: string } | null)?.name ?? null }} href={`${BASE}/${c.id}`} />
                {pattern && (
                  <p className="flex flex-wrap gap-x-3 px-1 text-xs text-muted-foreground">
                    {scamKey && <span>{tScam(scamKey)}</span>}
                    {brandKey && <span>{tBrand(brandKey)}</span>}
                    <span>{t("patternSizeCount", { count: pattern.size })}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{t("campaign")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("severity")}</TableHead>
                <TableHead className="w-44">{t("volume")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("classification")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("owner")}</TableHead>
                <TableHead className="hidden md:table-cell pr-5">{t("activityCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const pattern = patterns.get(c.id);
                const scamKey = asScamType(pattern?.scamType);
                const brandKey = asBrandCategory(pattern?.brand);
                const name = (c.institutions as { name: string } | null)?.name ?? c.imitated_name ?? "—";
                const owner = (c.owner as { full_name: string | null } | null)?.full_name;
                return (
                  <TableRow key={c.id} className="group">
                    {/* Severity stripe on the first cell; SeverityDot carries the word. */}
                    <TableCell className={cn("relative pl-5 before:absolute before:inset-y-1.5 before:left-1.5 before:w-1 before:rounded-full", SEVERITY_STRIPE[c.severity])}>
                      <Link href={`${BASE}/${c.id}`} className="block min-w-48 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                        <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          {c.code}
                          {c.is_public && <Globe className="size-3 text-primary" aria-label={t("public")} />}
                        </span>
                        <span className="block font-medium group-hover:text-primary group-hover:underline">{name}</span>
                        <span className="block text-xs text-muted-foreground capitalize">{c.tactic.replace(/_/g, " ")}</span>
                      </Link>
                    </TableCell>
                    <TableCell><CampaignStatusBadge status={c.status} className="whitespace-nowrap" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><SeverityDot severity={c.severity} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span className="block h-full rounded-full bg-chart-1" style={{ width: `${Math.max(4, (c.message_count / maxVolume) * 100)}%` }} />
                        </span>
                        <span className="text-sm font-medium tabular-nums">{c.message_count}</span>
                      </div>
                      {pattern && <span className="text-xs text-muted-foreground">{t("patternSizeCount", { count: pattern.size })}</span>}
                    </TableCell>
                    <TableCell className="hidden text-xs xl:table-cell">
                      {scamKey || brandKey ? (
                        <>
                          <span className="block">{scamKey ? tScam(scamKey) : "—"}</span>
                          <span className="block text-muted-foreground">{brandKey ? tBrand(brandKey) : ""}</span>
                        </>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">{owner ?? <span className="text-muted-foreground">{t("unowned")}</span>}</TableCell>
                    <TableCell className="hidden pr-5 text-xs md:table-cell">
                      <span className="block font-medium">{fmtAgo(pattern?.lastSeen ?? c.last_seen, locale)}</span>
                      <span className="block text-muted-foreground">{t("since", { date: fmtDate(pattern?.firstSeen ?? c.first_seen, locale) })}</span>
                    </TableCell>
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
    <DashPage title={t("campaigns")} subtitle={tx("pages.campaigns")} actions={<Suspense fallback={<Skeleton className="h-9 w-72 rounded-full" />}><Actions /></Suspense>}>
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}><Pipeline searchParams={searchParams} /></Suspense>
      <Suspense fallback={<div className="grid gap-6 xl:grid-cols-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className={cn("h-80 rounded-xl", i % 3 === 0 && "xl:col-span-2")} />)}</div>}>
        <Insights searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}><Filters searchParams={searchParams} /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Results searchParams={searchParams} /></Suspense>
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}><CheckAggregates /></Suspense>
    </DashPage>
  );
}
