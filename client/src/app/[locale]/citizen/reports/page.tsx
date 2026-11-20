import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import {
  Ban, ChevronRight, CircleCheck, Copy, FileText, Gavel, Globe, Hourglass, Mail, MessageSquare, Phone, QrCode,
  Send, Share2, ShieldAlert, Siren, type LucideIcon,
} from "lucide-react";
import { FlagBadge } from "@/components/flags/flag-badge";
import { UrlToggle } from "@/components/shared/url-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { PUBLIC_STATUS_ORDER } from "@/server/reports";
import type { Enums } from "@/types/database";

type Status = Enums<"report_status">;
const CLOSED: Status[] = ["taken_down", "not_scam", "duplicate"];
const CHANNEL_ICON: Record<string, LucideIcon> = { sms: MessageSquare, email: Mail, social: Share2, web: Globe, qr: QrCode, call: Phone, other: FileText };
const STATUS_STYLE: Record<Status, { Icon: LucideIcon; tone: string }> = {
  received: { Icon: Send, tone: "border-border bg-muted text-foreground" },
  under_review: { Icon: Hourglass, tone: "border-flag-yellow/40 bg-flag-yellow/10 text-foreground" },
  confirmed: { Icon: ShieldAlert, tone: "border-flag-red/40 bg-flag-red/10 text-foreground" },
  takedown_requested: { Icon: Gavel, tone: "border-flag-orange/40 bg-flag-orange/10 text-foreground" },
  taken_down: { Icon: CircleCheck, tone: "border-flag-green/40 bg-flag-green/10 text-foreground" },
  not_scam: { Icon: Ban, tone: "border-border bg-muted text-muted-foreground" },
  duplicate: { Icon: Copy, tone: "border-border bg-muted text-muted-foreground" },
};
const STATUS_ICON_TONE: Record<Status, string> = {
  received: "text-muted-foreground", under_review: "text-flag-yellow", confirmed: "text-flag-red", takedown_requested: "text-flag-orange",
  taken_down: "text-flag-green", not_scam: "text-muted-foreground", duplicate: "text-muted-foreground",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("reports") };
}

async function Content({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await requireUser();
  const [{ show }, t, ts, tc, locale] = await Promise.all([searchParams, getTranslations("cit.reports"), getTranslations("reportStatus"), getTranslations("channel"), getLocale()]);
  const { data } = await ctx.supabase
    .from("reports")
    .select("id, protocol, status, channel, flag, score, created_at, resolution_note, campaigns(code)")
    .eq("reporter_id", ctx.user.id)
    .order("created_at", { ascending: false });
  const all = data ?? [];

  if (!all.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-primary/10"><Siren className="size-7 text-primary" aria-hidden="true" /></span>
          <p className="font-display text-xl font-medium">{t("empty")}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Button asChild className="mt-2 rounded-full"><Link href="/report">{t("newReport")}</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const isClosed = (s: Status) => CLOSED.includes(s);
  const stats = [
    { k: "total", v: all.length, Icon: FileText, tone: "text-primary" },
    { k: "open", v: all.filter((r) => !isClosed(r.status)).length, Icon: Hourglass, tone: "text-flag-yellow" },
    { k: "confirmed", v: all.filter((r) => ["confirmed", "takedown_requested", "taken_down"].includes(r.status)).length, Icon: ShieldAlert, tone: "text-flag-red" },
    { k: "takenDown", v: all.filter((r) => r.status === "taken_down").length, Icon: CircleCheck, tone: "text-flag-green" },
  ] as const;
  const view = show === "open" || show === "closed" ? show : "all";
  const shown = view === "all" ? all : all.filter((r) => (view === "closed") === isClosed(r.status));

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ k, v, Icon, tone }) => (
          <li key={k}>
            <Card className="py-4">
              <CardContent className="flex items-center gap-3 px-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon className={cn("size-5", tone)} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="font-display text-2xl leading-none font-bold">{v}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{t(`stats.${k}`)}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <UrlToggle
        name="show"
        label={t("filter")}
        options={(["all", "open", "closed"] as const).map((f) => ({ value: f, label: t(`filters.${f}`) }))}
      />

      {!shown.length ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t("noneInFilter")}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const idx = PUBLIC_STATUS_ORDER.indexOf(r.status);
            const ChannelIcon = CHANNEL_ICON[r.channel ?? "other"] ?? FileText;
            const st = STATUS_STYLE[r.status];
            const code = (r.campaigns as { code: string } | null)?.code;
            return (
              <li key={r.id}>
                <Card className="relative gap-4 py-5 transition-colors hover:border-primary/40">
                  <CardContent className="space-y-4 px-5">
                    <div className="flex flex-wrap items-start gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <ChannelIcon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/citizen/reports/${r.id}`}
                            className="font-mono font-semibold tracking-wide after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                          >
                            {r.protocol}
                          </Link>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", st.tone)}>
                            <st.Icon className={cn("size-3.5", STATUS_ICON_TONE[r.status])} aria-hidden="true" />
                            {ts(r.status)}
                          </span>
                          {r.flag && <FlagBadge flag={r.flag} score={r.score} />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("sentAt", { date: fmtDateTime(r.created_at, locale) })}
                          {r.channel && <> · {t("via", { channel: tc(r.channel) })}</>}
                        </p>
                      </div>
                      <span className="hidden items-center gap-1 self-center text-sm font-medium text-primary sm:inline-flex">
                        {t("details")}<ChevronRight className="size-4" aria-hidden="true" />
                      </span>
                    </div>

                    {idx !== -1 && (
                      <ol className="grid grid-cols-5 gap-1.5" aria-label={ts(r.status)}>
                        {PUBLIC_STATUS_ORDER.map((s, i) => {
                          const done = i < idx || (i === idx && s === "taken_down");
                          const current = i === idx && !done;
                          return (
                            <li key={s} className="space-y-1.5" aria-current={current ? "step" : undefined}>
                              <span className={cn("block h-1.5 rounded-full", done || current ? "bg-primary" : "bg-muted")} />
                              <span className={cn("hidden text-[11px] leading-tight md:block", current ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60")}>{ts(s)}</span>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    {(code || (r.resolution_note && r.resolution_note !== "need_more_info")) && (
                      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-sm">
                        {code && <p className="text-muted-foreground">{t("linked", { code })}</p>}
                        {r.resolution_note && r.resolution_note !== "need_more_info" && (
                          <p><span className="text-muted-foreground">{t("outcome")}:</span> {r.resolution_note}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      <Skeleton className="h-9 w-64" />
      {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ show?: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.reports");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild className="self-start rounded-full md:self-auto"><Link href="/report"><Siren className="size-4" aria-hidden="true" />{t("newReport")}</Link></Button>
      </header>
      <Suspense fallback={<ReportsSkeleton />}><Content searchParams={searchParams} /></Suspense>
    </div>
  );
}
