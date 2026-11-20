import { Download } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashPage } from "@/components/layout/dash";
import { Pager } from "@/components/shared/pager";
import { UrlSearch } from "@/components/shared/url-search";
import { UrlSelect } from "@/components/shared/url-select";
import { DomainsTable } from "@/components/soc/domains-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/server/auth";
import { getDomains } from "@/server/queries/soc";

type Search = Promise<{ status?: string; cls?: string; q?: string; page?: string }>;
const STATUS = ["watching", "threat", "dismissed", "taken_down", "allowlisted"] as const;
const CLASSES = ["typosquat", "homoglyph", "combosquat", "legitimate", "unknown"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("domains") };
}

async function Filters() {
  const [t, tu, tc] = await Promise.all([getTranslations("soc.domains"), getTranslations("ui"), getTranslations("domainClass")]);
  return (
    <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-3 sm:items-end [&_button[role=combobox]]:w-full">
      <UrlSearch label={tu("search")} />
      <UrlSelect name="status" label={t("status")} anyLabel={tu("all")} options={STATUS.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
      <UrlSelect name="cls" label={t("class")} anyLabel={tu("all")} options={CLASSES.map((c) => ({ value: c, label: tc(c) }))} />
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [tu, tx] = await Promise.all([getTranslations("ui"), getTranslations("socx")]);
  const data = await getDomains(ctx.supabase, { status: STATUS.find((s) => s === sp.status), cls: CLASSES.find((c) => c === sp.cls), q: sp.q?.slice(0, 200), page: Number(sp.page) || 1 });
  const { data: links } = data.rows.length
    ? await ctx.supabase.from("campaign_domains").select("domain_id, campaigns(id, code)").in("domain_id", data.rows.map((r) => r.id))
    : { data: [] };
  const byDomain: Record<string, { id: string; code: string }[]> = {};
  for (const l of links ?? []) {
    const c = l.campaigns as { id: string; code: string } | null;
    if (c) (byDomain[l.domain_id] ??= []).push(c);
  }
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground tabular-nums">{tx("results", { count: data.total })}</span><Button asChild variant="outline" size="sm" className="rounded-full"><a href={`/api/soc/export/domains?${qs}`}><Download className="size-3.5" aria-hidden="true" />{tu("exportCsv")}</a></Button></div>
      <DomainsTable rows={data.rows} campaignsByDomain={byDomain} />
      <Pager page={data.page} pages={data.pages} />
    </div>
  );
}

export default async function DomainsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("domains")} subtitle={tx("pages.domains")}>
      <Suspense fallback={<Skeleton className="h-20 w-full rounded-xl" />}><Filters /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Results searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
