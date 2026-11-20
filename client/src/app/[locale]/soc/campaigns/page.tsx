import { Download, Globe, LayoutGrid, List } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
import { getCampaignPatternMap, getCampaigns } from "@/server/queries/soc";

type Search = Promise<{ status?: string; q?: string; view?: string }>;
const STATUS = ["monitoring", "confirmed", "takedown_in_progress", "resolved"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("campaigns") };
}

async function Toolbar() {
  const ctx = await requireRole("soc_analyst");
  const [inst, camps, t, tu, ts] = await Promise.all([
    ctx.supabase.from("institutions").select("id, name").order("name"),
    getCampaigns(ctx.supabase),
    getTranslations("soc.campaigns"),
    getTranslations("ui"),
    getTranslations("campaignStatus"),
  ]);
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <UrlSearch label={tu("search")} className="sm:w-64" />
        <UrlSelect name="status" label={t("status")} anyLabel={tu("all")} options={STATUS.map((s) => ({ value: s, label: ts(s) }))} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><a href="/api/soc/export/campaigns"><Download className="size-3.5" aria-hidden="true" />{tu("exportCsv")}</a></Button>
        <MergeDialog campaigns={camps.map((c) => ({ id: c.id, code: c.code, imitated_name: c.imitated_name }))} />
        <CreateCampaignDialog institutions={inst.data ?? []} />
      </div>
    </div>
  );
}

async function List_({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const t = await getTranslations("soc.campaigns");
  const ts = await getTranslations("campaignStatus");
  const tScam = await getTranslations("scamType");
  const tBrand = await getTranslations("brandCategory");
  const locale = await getLocale();
  const status = STATUS.find((s) => s === sp.status);
  const rows = await getCampaigns(ctx.supabase, { status, q: sp.q?.slice(0, 100) });
  const patterns = await getCampaignPatternMap(ctx.supabase, rows.map((c) => c.id));
  const view = sp.view === "grid" ? "grid" : "table";
  const toggle = (
    <div className="flex gap-1" role="group">
      <Button asChild size="sm" variant={view === "table" ? "secondary" : "ghost"}><Link href={`/soc/campaigns?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.q ? { q: sp.q } : {}), view: "table" })}`}><List className="size-4" aria-hidden="true" />{t("table")}</Link></Button>
      <Button asChild size="sm" variant={view === "grid" ? "secondary" : "ghost"}><Link href={`/soc/campaigns?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.q ? { q: sp.q } : {}), view: "grid" })}`}><LayoutGrid className="size-4" aria-hidden="true" />{t("grid")}</Link></Button>
    </div>
  );
  if (!rows.length) return <div className="space-y-3">{toggle}<EmptyState title={t("empty")} /></div>;
  return (
    <div className="space-y-3">
      {toggle}
      {view === "grid" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="overflow-x-auto rounded-xl border border-border">
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
                  <TableCell className="font-mono text-xs"><Link className="hover:underline" href={`/soc/campaigns/${c.id}`}>{c.code}</Link>{c.is_public && <Globe className="ml-1 inline size-3 text-primary" aria-label={t("public")} />}</TableCell>
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
    </div>
  );
}

export default async function CampaignsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("campaigns")} />
      <Suspense fallback={<Skeleton className="h-28 w-full" />}><CheckAggregates /></Suspense>
      <Suspense fallback={<Skeleton className="h-12 w-full" />}><Toolbar /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><List_ searchParams={searchParams} /></Suspense>
    </div>
  );
}
