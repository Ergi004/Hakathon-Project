import { MapPin, Send } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { FlagBadge } from "@/components/flags/flag-badge";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/shared/pager";
import { UrlSelect } from "@/components/shared/url-select";
import { IntelLive } from "@/components/soc/intel-live";
import { UrlSwitch } from "@/components/soc/url-switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { flagForScore } from "@/lib/flags";
import { fmtAgo } from "@/lib/format";
import { requireRole } from "@/server/auth";
import { getIntelKpis, getIntelScans, INTEL_CHANNELS, INTEL_STATUSES, INTEL_VERDICTS, type IntelFilters } from "@/server/queries/intel";

type Search = Promise<Record<string, string | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("intel") };
}

function pick<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

async function Filters() {
  const t = await getTranslations("soc.intel");
  const tu = await getTranslations("ui");
  const tc = await getTranslations("channel");
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      <UrlSelect name="channel" label={t("channel")} anyLabel={tu("all")} options={INTEL_CHANNELS.map((c) => ({ value: c, label: tc(c) }))} />
      <UrlSelect name="verdict" label={t("verdictLabel")} anyLabel={tu("all")} options={INTEL_VERDICTS.map((v) => ({ value: v, label: t(`verdict.${v}`) }))} />
      <UrlSelect name="status" label={t("statusLabel")} anyLabel={tu("all")} options={INTEL_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))} />
      <UrlSwitch name="al" label={t("albaniaOnly")} />
      <UrlSwitch name="vt" label={t("vtOnly")} />
      <UrlSwitch name="xf" label={t("exfilOnly")} />
    </div>
  );
}

async function Kpis({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const t = await getTranslations("soc.intel.kpi");
  const k = await getIntelKpis(ctx.supabase, sp.al === "1");
  const tiles = [
    { label: t("total"), value: k.total },
    { label: t("email"), value: k.email },
    { label: t("sms"), value: k.sms },
    { label: t("malicious"), value: k.malicious },
    { label: t("vtHits"), value: k.vtHits },
    { label: t("exfil"), value: k.exfil },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((x) => (
        <div key={x.label} className="glass-card rounded-xl p-3">
          <p className="text-xs text-muted-foreground">{x.label}</p>
          <p className="font-display text-2xl tabular-nums">{x.value}</p>
        </div>
      ))}
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const t = await getTranslations("soc.intel");
  const tc = await getTranslations("channel");
  const locale = await getLocale();
  const f: IntelFilters = {
    channel: pick(sp.channel, INTEL_CHANNELS),
    verdict: pick(sp.verdict, INTEL_VERDICTS),
    status: pick(sp.status, INTEL_STATUSES),
    albania: sp.al === "1",
    vtOnly: sp.vt === "1",
    exfilOnly: sp.xf === "1",
    page: Number(sp.page) || 1,
  };
  const data = await getIntelScans(ctx.supabase, f);
  const tx = (key: string, fallback: string): string => (t.has(key as never) ? t(key as never) : fallback);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <IntelLive albaniaOnly={f.albania} />
        <span className="text-xs text-muted-foreground">{data.total}</span>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="glass-card overflow-x-auto rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.risk")}</TableHead>
                <TableHead>{t("col.channel")}</TableHead>
                <TableHead>{t("col.verdict")}</TableHead>
                <TableHead>{t("col.virusTotal")}</TableHead>
                <TableHead>{t("col.exfil")}</TableHead>
                <TableHead>{t("col.type")}</TableHead>
                <TableHead>{t("col.family")}</TableHead>
                <TableHead>{t("col.scope")}</TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead>{t("col.age")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const done = r.status === "completed" || r.status === "partial";
                return (
                  <TableRow key={r.id} className="relative">
                    <TableCell>
                      <Link href={`/soc/intel/${r.id}`} className="after:absolute after:inset-0 focus-visible:outline-none" aria-label={t("open", { id: r.id.slice(0, 8) })}>
                        <FlagBadge flag={done && r.risk_score !== null ? flagForScore(r.risk_score) : "grey"} score={done ? r.risk_score : null} />
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{tc(r.channel as "sms" | "email")}</Badge></TableCell>
                    <TableCell>{t(`verdict.${r.verdict as "unknown"}`)}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.vt_max_malicious === null ? <span className="text-muted-foreground">—</span> : r.vt_max_malicious > 0 ? <span className="font-medium text-flag-red">{t("engines", { n: r.vt_max_malicious })}</span> : <span className="text-flag-green">0</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {data.exfil[r.id]?.length ? (
                        <span className="inline-flex items-center gap-1 font-medium text-flag-red">
                          <Send className="size-3" aria-hidden="true" />
                          {[...new Set(data.exfil[r.id])].slice(0, 2).map((k) => tx(`exfil.kind.${k}`, k)).join(", ")}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{r.phishing_type ? tx(`type.${r.phishing_type}`, r.phishing_type) : "—"}</TableCell>
                    <TableCell className="text-xs">{r.phishing_family ? tx(`family.${r.phishing_family}`, r.phishing_family) : "—"}</TableCell>
                    <TableCell>{r.albania && <Badge variant="outline" className="gap-1"><MapPin className="size-3" aria-hidden="true" />AL</Badge>}</TableCell>
                    <TableCell className="text-xs">{done ? t(`status.${r.status as "completed"}`) : `${t(`status.${r.status as "queued"}`)} · ${r.progress}%`}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtAgo(r.created_at, locale)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={data.page} pages={data.pages} />
    </div>
  );
}

export default async function IntelPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc.nav");
  const ti = await getTranslations("soc.intel");
  return (
    <div className="space-y-5">
      <PageHeader title={t("intel")} description={ti("description")} />
      <Suspense fallback={<Skeleton className="h-20 w-full" />}><Kpis searchParams={searchParams} /></Suspense>
      <Suspense fallback={<Skeleton className="h-16 w-full" />}><Filters /></Suspense>
      <Suspense fallback={<div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
