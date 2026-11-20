"use client";

import { ChevronDown, CircleHelp, CircleSlash, ExternalLink, FlaskConical, Loader2, OctagonX, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface IntelRow {
  key: string;
  provider: string;
  tier: "A" | "B";
  status: string;
  verdict: string;
  maliciousCount: number | null;
  totalCount: number | null;
  summary: Record<string, unknown>;
  reportUrl: string | null;
  error: string | null;
}
export interface IntelSub { subdomain: string; source: string; resolves: boolean | null; firstCertAt: string | null; verdict: string; brandToken: boolean }
export interface IntelState { status: "running" | "done" | "error" | "cancelled" | "timeout"; mock: boolean; rows: IntelRow[]; subdomains: IntelSub[]; domainAgeDays: number | null; registeredAt: string | null }

const CHIP: Record<string, { icon: LucideIcon; cls: string }> = {
  malicious: { icon: OctagonX, cls: "border-flag-darkred/50 bg-flag-darkred/15" },
  suspicious: { icon: TriangleAlert, cls: "border-flag-orange/50 bg-flag-orange/15" },
  clean: { icon: ShieldCheck, cls: "border-flag-green/50 bg-flag-green/12" },
  unknown: { icon: CircleHelp, cls: "border-border bg-muted" },
  unavailable: { icon: CircleSlash, cls: "border-border bg-muted text-muted-foreground" },
  pending: { icon: Loader2, cls: "border-border" },
};

/** Verdict chip: always icon + word (never colour alone). */
export function VerdictChip({ status, verdict }: { status: string; verdict: string }) {
  const t = useTranslations("intel.verdicts");
  const key = status === "pending" ? "pending" : status === "unavailable" || status === "error" || status === "skipped" ? "unavailable" : verdict;
  const c = CHIP[key] ?? CHIP.unknown;
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap", c.cls)}>
      <Icon className={cn("size-3.5", key === "pending" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
      {t(key as "clean")}
    </span>
  );
}

function detail(row: IntelRow, t: ReturnType<typeof useTranslations<"intel">>): string | null {
  const s = row.summary;
  switch (row.provider) {
    case "dns": return row.status === "done" ? (s.resolves ? t("resolves") : t("notResolves")) : null;
    case "rdap": return typeof s.registrar === "string" ? t("registrar", { name: s.registrar }) : null;
    case "urlhaus": return row.status === "done" ? (s.listed ? t("listed") : t("notListed")) : null;
    case "crtsh": return typeof s.count === "number" ? t("certs", { count: s.count }) : null;
    case "virustotal": return row.totalCount ? `${t("engines", { malicious: row.maliciousCount ?? 0, total: row.totalCount })}${Array.isArray(s.categories) && s.categories.length ? ` · ${(s.categories as string[]).join(", ")}` : ""}` : null;
    case "hybrid_analysis": return typeof s.threatScore === "number" ? t("threatScore", { score: s.threatScore }) : typeof s.verdict === "string" ? s.verdict : null;
    case "internal": return typeof s.imitates === "string" ? `${s.lookalike} → ${s.imitates}` : null;
    default: return null;
  }
}

export function AgeBadge({ days }: { days: number | null }) {
  const t = useTranslations("intel.age");
  if (days === null) return <Badge variant="outline" className="gap-1"><CircleHelp className="size-3.5" aria-hidden="true" />{t("unknown")}</Badge>;
  const young = days < 30;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", young ? "border-flag-red/50 bg-flag-red/12" : "border-border")}>
      {young ? <TriangleAlert className="size-3.5 text-flag-red" aria-hidden="true" /> : <ShieldCheck className="size-3.5 text-flag-green" aria-hidden="true" />}
      {days === 0 ? t("today") : t("days", { count: days })}
    </span>
  );
}

/** Shared live-scan card: provider rows, domain age, subdomains. */
export function IntelPanel({ state, staff = false, reconnecting = false, title }: { state: IntelState; staff?: boolean; reconnecting?: boolean; title?: string }) {
  const t = useTranslations("intel");
  const [q, setQ] = useState("");
  const [brandOnly, setBrandOnly] = useState(false);
  const order = ["internal", "dns", "rdap", "urlhaus", "crtsh", "virustotal", "hybrid_analysis"];
  const rows = [...state.rows].sort((a, b) => (a.tier === b.tier ? order.indexOf(a.provider) - order.indexOf(b.provider) : a.tier < b.tier ? -1 : 1));
  const subs = useMemo(() => state.subdomains.filter((s) => (!brandOnly || s.brandToken) && (!q || s.subdomain.includes(q.toLowerCase()))), [state.subdomains, q, brandOnly]);

  return (
    <section className="glass-card space-y-4 rounded-2xl p-4 md:p-5" aria-live="polite" aria-busy={state.status === "running"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-medium">{title ?? t("title")}</h3>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.mock && <Badge variant="secondary" className="gap-1"><FlaskConical className="size-3.5" aria-hidden="true" />{t("demo")}</Badge>}
          <Badge variant="outline" className="gap-1">
            {state.status === "running" && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {reconnecting ? t("reconnecting") : state.status === "running" ? t("running") : state.status === "done" ? t("done") : t("error")}
          </Badge>
        </div>
      </div>

      {(state.domainAgeDays !== null || state.status !== "running") && <AgeBadge days={state.domainAgeDays} />}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 && <li className="p-3 text-sm text-muted-foreground">{t("running")}</li>}
        {rows.map((r) => {
          const d = detail(r, t);
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
              <span className="min-w-0 flex-1 font-medium">
                {t(`providers.${r.provider as "dns"}`)}
                {r.tier === "B" && <span className="ml-1 text-xs font-normal text-muted-foreground">({t("deepTier")})</span>}
                {d && <span className="block text-xs font-normal text-muted-foreground">{d}</span>}
              </span>
              {staff && r.reportUrl && <a href={r.reportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"><ExternalLink className="size-3" aria-hidden="true" />{t("openReport")}</a>}
              <VerdictChip status={r.status} verdict={r.verdict} />
            </li>
          );
        })}
      </ul>

      {state.subdomains.length > 0 && (
        <Collapsible defaultOpen={staff}>
          <CollapsibleTrigger className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
            <ChevronDown className="size-4" aria-hidden="true" />{t("subdomains", { count: state.subdomains.length })}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {staff && (
              <div className="flex flex-wrap items-center gap-3">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filter")} aria-label={t("filter")} className="h-8 w-56" />
                <label className="inline-flex items-center gap-2 text-xs"><Switch checked={brandOnly} onCheckedChange={setBrandOnly} />{t("brandOnly")}</label>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-2 font-medium">{t("subdomain")}</th><th className="p-2 font-medium">{t("source")}</th><th className="p-2 font-medium">{t("resolvesCol")}</th><th className="hidden p-2 font-medium sm:table-cell">{t("firstCert")}</th><th className="p-2 font-medium">{t("verdict")}</th></tr></thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.subdomain} className="border-t border-border">
                      <td className="max-w-48 truncate p-2 font-mono">{s.subdomain}</td>
                      <td className="p-2">{s.source}</td>
                      <td className="p-2">{s.resolves === null ? "—" : s.resolves ? "✓" : "✗"}<span className="sr-only">{s.resolves ? t("resolves") : t("notResolves")}</span></td>
                      <td className="hidden p-2 sm:table-cell">{s.firstCertAt ?? "—"}</td>
                      <td className="p-2"><VerdictChip status="done" verdict={s.verdict} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
