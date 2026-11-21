import { ExternalLink, Inbox } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyPanel } from "@/components/layout/dash";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Pager } from "@/components/shared/pager";
import { UrlSearch } from "@/components/shared/url-search";
import { UrlSelect } from "@/components/shared/url-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { FLAG_LEVELS } from "@/lib/flags";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { pageParam } from "@/lib/pagination";
import { CHANNELS } from "@/lib/schemas/analysis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getInbox, PERIOD_DAYS, type InboxFilters } from "@/server/queries/soc";

export const REPORT_STATUSES = ["received", "under_review", "confirmed", "not_scam", "takedown_requested", "taken_down", "duplicate"] as const;
export const REPORT_SOURCES = ["citizen_check", "citizen_report", "extension", "feed", "business", "import"] as const;
const PAGE_SIZE = 25;

export type ReportSearch = { q?: string; status?: string; flag?: string; channel?: string; source?: string; period?: string; page?: string };

function pick<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** URL → validated report filters (shared by the inbox and the campaign Reports tab). */
export function parseReportFilters(sp: ReportSearch): InboxFilters {
  const days = Number(sp.period);
  return {
    q: sp.q?.slice(0, 200) || undefined,
    status: pick(sp.status, REPORT_STATUSES),
    flag: pick(sp.flag, FLAG_LEVELS),
    channel: pick(sp.channel, CHANNELS),
    source: pick(sp.source, REPORT_SOURCES),
    days: (PERIOD_DAYS as readonly number[]).includes(days) ? days : undefined,
    page: pageParam(sp.page),
  };
}

/** Campaign workspace → Reports tab: the campaign's reports with filters and pagination. */
export async function CampaignReports({ db, userId, campaignId, sp }: { db: SupabaseClient<Database>; userId: string; campaignId: string; sp: ReportSearch }) {
  const [t, ti, tu, ts, tf, tc, locale] = await Promise.all([
    getTranslations("soc.campaign"),
    getTranslations("soc.inbox"),
    getTranslations("ui"),
    getTranslations("reportStatus"),
    getTranslations("flags"),
    getTranslations("channel"),
    getLocale(),
  ]);
  const f = parseReportFilters(sp);
  const data = await getInbox(db, { ...f, campaign: campaignId, size: PAGE_SIZE }, userId);
  const filtered = !!(f.q || f.status || f.flag || f.channel || f.source || f.days);
  const inboxQs = new URLSearchParams({ campaign: campaignId });
  for (const k of ["q", "status", "flag", "channel", "source", "period"] as const) if (sp[k]) inboxQs.set(k, sp[k]!);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 2xl:items-end [&_button[role=combobox]]:w-full">
        <UrlSearch label={ti("search")} className="sm:col-span-2 lg:col-span-3 2xl:col-span-1" />
        <UrlSelect name="status" label={ti("status")} anyLabel={tu("all")} options={REPORT_STATUSES.map((s) => ({ value: s, label: ts(s) }))} />
        <UrlSelect name="flag" label={ti("flag")} anyLabel={tu("all")} options={FLAG_LEVELS.map((x) => ({ value: x, label: tf(x) }))} />
        <UrlSelect name="channel" label={ti("channel")} anyLabel={tu("all")} options={CHANNELS.map((x) => ({ value: x, label: tc(x) }))} />
        <UrlSelect name="source" label={ti("source")} anyLabel={tu("all")} options={REPORT_SOURCES.map((x) => ({ value: x, label: x.replace(/_/g, " ") }))} />
        <UrlSelect name="period" label={ti("period")} anyLabel={tu("all")} options={PERIOD_DAYS.map((d) => ({ value: String(d), label: tu(`periodDays.${d}`) }))} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">{t("reportsShown", { count: data.total })}</span>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href={`/soc/inbox?${inboxQs}`}><ExternalLink className="size-3.5" aria-hidden="true" />{t("openInInbox")}</Link>
        </Button>
      </div>

      {!data.rows.length ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Inbox} title={filtered ? ti("empty") : t("noReports")} /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">{ti("columns.protocol")}</TableHead>
                <TableHead>{ti("columns.flag")}</TableHead>
                <TableHead>{ti("columns.status")}</TableHead>
                <TableHead className="hidden md:table-cell">{ti("columns.channel")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("excerpt")}</TableHead>
                <TableHead className="hidden lg:table-cell">{ti("columns.assignee")}</TableHead>
                <TableHead className="pr-5">{ti("columns.age")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-mono text-xs"><Link href={`/soc/inbox/${r.id}`} className="font-medium text-primary hover:underline">{r.protocol}</Link></TableCell>
                  <TableCell>{r.flag ? <FlagBadge flag={r.flag} score={r.score} /> : "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="whitespace-nowrap">{ts(r.status)}</Badge></TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{r.channel ? tc(r.channel) : "—"}</TableCell>
                  <TableCell className="hidden max-w-sm truncate text-xs text-muted-foreground xl:table-cell">{r.excerpt || "—"}</TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{r.assignee ?? <span className="text-muted-foreground">{ti("unassignedOnly")}</span>}</TableCell>
                  <TableCell className="pr-5 text-xs whitespace-nowrap"><time dateTime={r.created_at} title={fmtDateTime(r.created_at, locale)}>{fmtAgo(r.created_at, locale)}</time></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={data.page} pages={data.pages} />
    </div>
  );
}
