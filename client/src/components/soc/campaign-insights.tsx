import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FlagIcon } from "@/components/flags/flag-icon";
import { STATUS_STYLE } from "@/components/shared/campaign-status";
import { SeverityDot } from "@/components/shared/severity-dot";
import { Link } from "@/i18n/navigation";
import { FLAG_STYLES, type FlagLevel } from "@/lib/flags";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

type Status = Enums<"campaign_status">;
type Severity = Enums<"severity">;

const STATUS_ORDER: Status[] = ["monitoring", "confirmed", "takedown_in_progress", "resolved"];
const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
const STATUS_BAR: Record<Status, string> = { monitoring: "bg-flag-grey", confirmed: "bg-flag-red", takedown_in_progress: "bg-flag-orange", resolved: "bg-flag-green" };
const STATUS_TILE: Record<Status, string> = { monitoring: "bg-flag-grey/12 text-flag-grey", confirmed: "bg-flag-red/12 text-flag-red", takedown_in_progress: "bg-flag-orange/14 text-flag-orange", resolved: "bg-flag-green/12 text-flag-green" };
const SEVERITY_CELL: Record<Severity, string> = { critical: "bg-flag-darkred", high: "bg-flag-red", medium: "bg-flag-orange", low: "bg-flag-yellow" };

/** Query-string helper: keeps the current filters, applies a patch, always returns to page 1. */
export function hrefWith(base: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const n = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v && k !== "page") n.set(k, v);
  const qs = n.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Campaign lifecycle as four linked steps with counts and a proportional bar.
 * Selecting a step filters the list; selecting the active step clears it.
 */
export function StatusPipeline({ counts, active, href }: { counts: Record<Status, number>; active?: Status; href: (status: Status | undefined) => string }) {
  const t = useTranslations("campaignStatus");
  const tc = useTranslations("soc.campaigns");
  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);
  return (
    <section aria-label={tc("pipeline")} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STATUS_ORDER.map((s, i) => {
          const { icon: Icon } = STATUS_STYLE[s];
          const pct = total ? Math.round((counts[s] / total) * 100) : 0;
          const on = active === s;
          return (
            <li key={s} className="relative">
              <Link
                href={href(on ? undefined : s)}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex h-full items-center gap-3 rounded-lg border p-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  on ? "border-primary/60 bg-primary/5" : "border-border hover:bg-accent/50",
                  active && !on && "opacity-60",
                )}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", STATUS_TILE[s])}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl leading-none font-bold tabular-nums">{counts[s]}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{t(s)} · {pct}%</span>
                </span>
              </Link>
              {i < STATUS_ORDER.length - 1 && (
                <ChevronRight aria-hidden="true" className="absolute top-1/2 -right-2.5 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground lg:block" />
              )}
            </li>
          );
        })}
      </ol>
      {total > 0 && (
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {STATUS_ORDER.map((s) => counts[s] > 0 && <span key={s} className={STATUS_BAR[s]} style={{ width: `${(counts[s] / total) * 100}%` }} />)}
        </div>
      )}
    </section>
  );
}

/** Ranked rows with an inline proportional bar. Each row can link somewhere. */
export function RankedBars({ rows, empty, barClass = "bg-chart-1" }: { rows: { key: string; label: ReactNode; meta?: ReactNode; value: number; valueLabel: string; href?: string }[]; empty: string; barClass?: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="space-y-1">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{r.valueLabel}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className={cn("block h-full rounded-full", barClass)} style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
              </span>
              {r.meta}
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} scroll={false} className="block rounded-lg px-2 py-2 transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{body}</Link>
            ) : (
              <div className="px-2 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Severity × status counts. Cell shade grows with the count; every cell is a filter link. */
export function SeverityMatrix({ cells, href }: { cells: { severity: Severity; status: Status; n: number }[]; href: (severity: Severity, status: Status) => string }) {
  const ts = useTranslations("campaignStatus");
  const tc = useTranslations("soc.campaigns");
  const get = (sv: Severity, st: Status) => cells.find((c) => c.severity === sv && c.status === st)?.n ?? 0;
  const max = Math.max(1, ...cells.map((c) => c.n));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] table-fixed border-separate border-spacing-1.5 text-sm">
        <caption className="sr-only">{tc("matrix")}</caption>
        <thead>
          <tr>
            <th className="w-28" />
            {STATUS_ORDER.map((st) => (
              <th key={st} scope="col" className="pb-1 text-left text-xs font-normal text-muted-foreground">{ts(st)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SEVERITY_ORDER.map((sv) => (
            <tr key={sv}>
              <th scope="row" className="pr-2 text-left font-normal"><SeverityDot severity={sv} /></th>
              {STATUS_ORDER.map((st) => {
                const n = get(sv, st);
                return (
                  <td key={st} className="p-0">
                    {n ? (
                      <Link
                        href={href(sv, st)}
                        scroll={false}
                        aria-label={`${ts(st)}, ${sv}: ${n}`}
                        className="relative block h-12 overflow-hidden rounded-lg ring-1 ring-foreground/10 transition-shadow hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span aria-hidden="true" className={cn("absolute inset-0", SEVERITY_CELL[sv])} style={{ opacity: 0.15 + 0.6 * (n / max) }} />
                        <span className="relative grid h-full place-items-center font-display text-lg font-bold tabular-nums">{n}</span>
                      </Link>
                    ) : (
                      <span className="grid h-12 place-items-center rounded-lg bg-muted/50 text-xs text-muted-foreground">0</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Segmented flag bar with an icon + word legend (flag colours never stand alone). */
export function FlagBreakdown({ rows, total }: { rows: { key: FlagLevel; n: number }[]; total: number }) {
  const t = useTranslations("flags");
  const order: FlagLevel[] = ["darkred", "red", "orange", "yellow", "green", "grey"];
  const sorted = order.map((f) => ({ key: f, n: rows.find((r) => r.key === f)?.n ?? 0 })).filter((r) => r.n > 0);
  if (!total) return null;
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {sorted.map((r) => <span key={r.key} style={{ width: `${(r.n / total) * 100}%`, backgroundColor: `var(--flag-${r.key})` }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {sorted.map((r) => (
          <li key={r.key} className="inline-flex items-center gap-1.5">
            <FlagIcon flag={r.key} className={cn("size-3.5", FLAG_STYLES[r.key].text)} />
            <span>{t(r.key)}</span>
            <span className="text-muted-foreground tabular-nums">{r.n} · {Math.round((r.n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
