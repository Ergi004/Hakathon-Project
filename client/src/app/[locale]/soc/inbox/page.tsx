import { Download } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashPage } from "@/components/layout/dash";
import { Pager } from "@/components/shared/pager";
import { UrlSearch } from "@/components/shared/url-search";
import { UrlSelect } from "@/components/shared/url-select";
import { InboxTable } from "@/components/soc/inbox-table";
import { SavedViews } from "@/components/soc/saved-views";
import { ShortcutHelp } from "@/components/soc/shortcut-help";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANNELS } from "@/lib/schemas/analysis";
import { FLAG_LEVELS } from "@/lib/flags";
import { requireRole } from "@/server/auth";
import { getInbox, type InboxFilters } from "@/server/queries/soc";

type Search = Promise<Record<string, string | undefined>>;
const STATUSES = ["received", "under_review", "confirmed", "not_scam", "takedown_requested", "taken_down", "duplicate"] as const;
const SOURCES = ["citizen_check", "citizen_report", "extension", "feed", "business", "import"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("inbox") };
}

function pick<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

async function Filters() {
  const t = await getTranslations("soc.inbox");
  const tu = await getTranslations("ui");
  const ts = await getTranslations("reportStatus");
  const tf = await getTranslations("flags");
  const tc = await getTranslations("channel");
  return (
    <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 2xl:items-end [&_button[role=combobox]]:w-full">
      <UrlSearch label={t("search")} className="sm:col-span-2 lg:col-span-3 2xl:col-span-1" />
      <UrlSelect name="status" label={t("status")} anyLabel={tu("all")} options={STATUSES.map((s) => ({ value: s, label: ts(s) }))} />
      <UrlSelect name="flag" label={t("flag")} anyLabel={tu("all")} options={FLAG_LEVELS.map((f) => ({ value: f, label: tf(f) }))} />
      <UrlSelect name="channel" label={t("channel")} anyLabel={tu("all")} options={CHANNELS.map((c) => ({ value: c, label: tc(c) }))} />
      <UrlSelect name="source" label={t("source")} anyLabel={tu("all")} options={SOURCES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} />
      <UrlSelect name="assigned" label={t("assigned")} anyLabel={t("anyone")} options={[{ value: "me", label: t("me") }, { value: "none", label: t("unassignedOnly") }]} />
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [t, tx] = await Promise.all([getTranslations("soc.inbox"), getTranslations("socx")]);
  const f: InboxFilters = {
    q: sp.q?.slice(0, 200),
    status: pick(sp.status, STATUSES),
    flag: pick(sp.flag, FLAG_LEVELS),
    channel: pick(sp.channel, CHANNELS),
    source: pick(sp.source, SOURCES),
    assigned: pick(sp.assigned, ["me", "none"] as const),
    page: Number(sp.page) || 1,
  };
  const [data, views] = await Promise.all([
    getInbox(ctx.supabase, f, ctx.user.id),
    ctx.supabase.from("saved_views").select("id, name, filters").eq("scope", "inbox").order("name"),
  ]);
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SavedViews views={(views.data ?? []).map((v) => ({ ...v, filters: v.filters as Record<string, string> }))} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">{tx("results", { count: data.total })}</span>
          <Button asChild variant="outline" size="sm" className="rounded-full"><a href={`/api/soc/export/reports?${exportQs}`}><Download className="size-3.5" aria-hidden="true" />{t("export")}</a></Button>
          <ShortcutHelp />
        </div>
      </div>
      <InboxTable rows={data.rows} />
      <Pager page={data.page} pages={data.pages} />
    </div>
  );
}

export default async function InboxPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("inbox")} subtitle={tx("pages.inbox")}>
      <Suspense fallback={<Skeleton className="h-20 w-full rounded-xl" />}><Filters /></Suspense>
      <Suspense fallback={<div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </DashPage>
  );
}
