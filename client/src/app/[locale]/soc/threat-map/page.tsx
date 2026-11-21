import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { HBar } from "@/components/charts/hbar";
import { ChartBar } from "lucide-react";
import { DashPage, EmptyPanel, Panel } from "@/components/layout/dash";
import { DefangedText } from "@/components/shared/defanged-text";
import { UrlSelect } from "@/components/shared/url-select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { fmtDate } from "@/lib/format";
import { asBrandCategory, asScamType } from "@/lib/pattern-labels";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth";
import { getPatternExplorer } from "@/server/queries/pattern-explorer";
import {
  asPatternKind,
  asPatternReason,
  asPatternWindow,
  PATTERN_KINDS,
  PATTERN_WINDOWS,
  type PatternReason,
} from "@/server/queries/pattern-summary";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("threatMap") };
}

type Search = Promise<Record<string, string | undefined>>;

function kept(sp: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (value) out[key] = value;
  }
  return out;
}

function href(sp: Record<string, string | undefined>, patch: Record<string, string | null>): string {
  const next = new URLSearchParams(kept(sp));
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const qs = next.toString();
  return qs ? `/soc/threat-map?${qs}` : "/soc/threat-map";
}

function labelOf(value: string, known: string | null, fallback: (key: string) => string): string {
  return known ? fallback(known) : value;
}

async function Explorer({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const days = asPatternWindow(sp.days);
  const kind = asPatternKind(sp.kind);
  const brand = asBrandCategory(sp.brand) ?? undefined;
  const scamType = asScamType(sp.type) ?? undefined;
  const reason = asPatternReason(sp.reason) ?? undefined;
  const weekday = sp.weekday !== undefined && /^[0-6]$/.test(sp.weekday) ? Number(sp.weekday) : undefined;
  const hour = sp.hour !== undefined && /^(?:[0-9]|1[0-9]|2[0-3])$/.test(sp.hour) ? Number(sp.hour) : undefined;
  const registrar = sp.registrar?.trim().slice(0, 80) || undefined;
  const [report, t, tu, tScam, tBrand, locale] = await Promise.all([
    getPatternExplorer(ctx.supabase, { days, kind, brand, scamType, reason, registrar, weekday, hour }),
    getTranslations("soc.patterns"),
    getTranslations("ui"),
    getTranslations("scamType"),
    getTranslations("brandCategory"),
    getLocale(),
  ]);
  const reasonLabel = (value: PatternReason) => {
    switch (value) {
      case "shared_exfil":
        return t("reasons.shared_exfil");
      case "shared_url":
        return t("reasons.shared_url");
      case "shared_domain":
        return t("reasons.shared_domain");
      default: {
        const unexpected: never = value;
        return unexpected;
      }
    }
  };
  const kindLabel = (value: (typeof PATTERN_KINDS)[number]) => {
    switch (value) {
      case "text":
        return t("kinds.text");
      case "url":
        return t("kinds.url");
      case "email_signals":
        return t("kinds.email_signals");
      case "phone":
        return t("kinds.phone");
      case "qr":
        return t("kinds.qr");
      default: {
        const unexpected: never = value;
        return unexpected;
      }
    }
  };
  const sum = (rows: { name: string; value: number }[]) => t("srPrefix", { summary: rows.map((row) => `${row.name}: ${row.value}`).join("; ") || tu("noData") });
  const max = Math.max(1, ...report.heat.flat());
  const daysLabels = t.raw("weekdays") as string[];
  const charts: [string, { name: string; value: number }[], string, string][] = [
    [t("byBrand"), report.byBrand.map((row) => ({ ...row, name: labelOf(row.name, asBrandCategory(row.name), (key) => tBrand(asBrandCategory(key) ?? "other")) })), "var(--chart-1)", "brand"],
    [t("byScamType"), report.byScamType.map((row) => ({ ...row, name: labelOf(row.name, asScamType(row.name), (key) => tScam(asScamType(key) ?? "other")) })), "var(--chart-2)", "type"],
    [t("byReason"), report.byReason.map((row) => ({ ...row, name: asPatternReason(row.name) ? reasonLabel(asPatternReason(row.name) as PatternReason) : row.name })), "var(--chart-4)", "reason"],
    [t("registrars"), report.registrars, "var(--chart-5)", "registrar"],
    [t("nameservers"), report.nameservers, "var(--chart-3)", "nameserver"],
    [t("hosting"), report.hosting, "var(--chart-1)", "hosting"],
  ];
  const empty = !report.patterns.length && !report.byBrand.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:flex-row lg:flex-wrap lg:items-end">
        <UrlSelect name="days" label={t("window")} anyLabel={t("days90")} options={PATTERN_WINDOWS.filter((value) => value !== 90).map((value) => ({ value: String(value), label: t(value === 7 ? "days7" : "days30") }))} />
        <UrlSelect name="kind" label={t("kind")} anyLabel={tu("all")} options={PATTERN_KINDS.map((value) => ({ value, label: kindLabel(value) }))} />
        <UrlSelect name="brand" label={t("brand")} anyLabel={tu("all")} options={report.brands.map((value) => ({ value, label: labelOf(value, asBrandCategory(value), (key) => tBrand(asBrandCategory(key) ?? "other")) }))} />
        <UrlSelect name="type" label={t("scamType")} anyLabel={tu("all")} options={report.scamTypes.map((value) => ({ value, label: labelOf(value, asScamType(value), (key) => tScam(asScamType(key) ?? "other")) }))} />
        <UrlSelect name="reason" label={t("connection")} anyLabel={tu("all")} options={report.reasons.map((value) => ({ value, label: reasonLabel(value) }))} />
        <UrlSelect name="registrar" label={t("registrars")} anyLabel={tu("all")} options={report.registrarNames.map((value) => ({ value, label: value }))} />
      </div>
      <p className="text-sm text-muted-foreground">{t("coverage", report.coverage)}</p>
      {empty ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={ChartBar} title={tu("noData")} /></div>
      ) : (
        <>
          <Panel title={t("list")}>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("brand")}</TableHead>
                    <TableHead>{t("scamType")}</TableHead>
                    <TableHead className="text-right">{t("checks")}</TableHead>
                    <TableHead className="text-right">{t("confidence")}</TableHead>
                    <TableHead>{t("seen")}</TableHead>
                    <TableHead>{t("connection")}</TableHead>
                    <TableHead>{t("place")}</TableHead>
                    <TableHead>{t("campaigns")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.patterns.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <Link href={href(sp, { brand: row.brand })} className="font-medium hover:underline">{labelOf(row.brand, asBrandCategory(row.brand), (key) => tBrand(asBrandCategory(key) ?? "other"))}</Link>
                      </TableCell>
                      <TableCell>{labelOf(row.scamType, asScamType(row.scamType), (key) => tScam(asScamType(key) ?? "other"))}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.confidence === null ? "—" : t("confidenceValue", { value: Math.round(row.confidence * 100) })}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={row.active ? "default" : "secondary"}>{row.active ? t("active") : t("quiet")}</Badge>
                        <div className="mt-1 text-muted-foreground">{fmtDate(row.firstSeen, locale)} – {fmtDate(row.lastSeen, locale)}</div>
                      </TableCell>
                      <TableCell className="max-w-56 text-xs">
                        {row.reason ? <div>{reasonLabel(row.reason)}</div> : null}
                        {row.evidence ? <DefangedText value={row.evidence} revealable={false} /> : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{row.hostingCountry ?? "—"}</div>
                        {row.claimedPlace ? <div className="text-muted-foreground">{row.claimedPlace}</div> : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.campaigns.length ? row.campaigns.map((campaign) => (
                          <div key={campaign.id}><Link href={`/soc/campaigns/${campaign.id}`} className="font-mono text-primary hover:underline">{campaign.code}</Link></div>
                        )) : t("noCampaign")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {charts.map(([title, data, color, key]) => (
              <Panel key={key} title={title}>
                {data.length ? <HBar data={data} label={title} summary={sum(data)} color={color} /> : <p className="py-10 text-center text-sm text-muted-foreground">{tu("noData")}</p>}
              </Panel>
            ))}
            <Panel title={t("heatmap")} className="lg:col-span-2 2xl:col-span-3">
              <p className="mb-3 text-xs text-muted-foreground">{t("timezone")}</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] table-fixed border-separate border-spacing-1 text-xs" aria-label={t("heatmap")}>
                  <thead><tr><th className="w-12" />{Array.from({ length: 24 }, (_, h) => <th key={h} scope="col" className="font-normal text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody>
                    {report.heat.map((row, day) => (
                      <tr key={day}>
                        <th scope="row" className="pr-1 text-right font-normal text-muted-foreground">{daysLabels[day]}</th>
                        {row.map((value, slot) => (
                          <td key={slot} className={cn("h-7 rounded-md text-center", value === 0 ? "bg-muted" : "bg-primary text-primary-foreground", weekday === day && hour === slot && "ring-2 ring-foreground")} style={value ? { opacity: 0.25 + 0.75 * (value / max) } : undefined}>
                            {value > 0 ? <Link href={href(sp, { weekday: String(day), hour: String(slot) })} className="block h-7" title={`${daysLabels[day]} ${slot}:00 · ${value}`}><span className="sr-only">{value}</span></Link> : <span className="sr-only">0</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export default async function ThreatMapPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("threatMap")} subtitle={tx("pages.threatMap")}>
      <Suspense fallback={<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>}>
        <Explorer searchParams={searchParams} />
      </Suspense>
    </DashPage>
  );
}
