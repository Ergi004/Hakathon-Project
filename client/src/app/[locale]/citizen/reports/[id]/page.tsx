import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { ReportDetailForm } from "@/components/citizen/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { FlagBadge } from "@/components/flags/flag-badge";
import { MaskedText } from "@/components/shared/masked-text";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { PUBLIC_STATUS_ORDER } from "@/server/reports";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("reports"), robots: { index: false } };
}

async function Detail({ params }: { params: Params }) {
  const { id, locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, ts, tc] = await Promise.all([getTranslations("cit.reports"), getTranslations("reportStatus"), getTranslations("campaignCard")]);
  if (!z.uuid().safeParse(id).success) return <EmptyState title={t("notFound")} />;
  const ctx = await requireUser();
  // RLS reports_owner_read: only the reporter's own report is returned.
  const { data: r } = await ctx.supabase.from("reports").select("id, protocol, status, flag, score, created_at, resolution_note, messages(body_masked), campaigns(code, is_public)").eq("id", id).eq("reporter_id", ctx.user.id).maybeSingle();
  if (!r) return <EmptyState title={t("notFound")} />;
  const { data: events } = await ctx.supabase.from("report_events").select("kind, data, created_at").eq("report_id", id).order("created_at");
  const reached = new Map<string, string>([["received", r.created_at]]);
  for (const e of events ?? []) { const to = (e.data as { to?: string }).to; if (e.kind === "status_change" && to) reached.set(to, e.created_at); }
  const idx = PUBLIC_STATUS_ORDER.indexOf(r.status);
  const camp = r.campaigns as { code: string; is_public: boolean } | null;
  const lang = await getLocale();
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-2"><h1 className="font-mono text-xl">{r.protocol}</h1>{r.flag && <FlagBadge flag={r.flag} score={r.score} />}</header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-card space-y-3 rounded-xl p-4">
          {idx === -1 ? <p>{ts(r.status)}</p> : <StatusTimeline steps={PUBLIC_STATUS_ORDER.map((s, i) => ({ key: s, label: ts(s), at: reached.get(s) ? fmtDateTime(reached.get(s)!, lang) : null, state: i < idx ? "done" : i === idx ? (s === "taken_down" ? "done" : "current") : "pending" }))} />}
          {camp?.is_public && <Button asChild size="sm" variant="outline"><Link href={`/threats/${encodeURIComponent(camp.code)}`}>{t("campaign")}: {camp.code} · {tc("open")}</Link></Button>}
          {r.status === "taken_down" && <p className="text-sm text-flag-green">{t("takedown")}: {ts("taken_down")}</p>}
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="font-medium">{t("content")}</h2>
          {(r.messages as { body_masked: string } | null)?.body_masked ? <MaskedText text={(r.messages as { body_masked: string }).body_masked} className="rounded-lg bg-muted/50 p-3" /> : <p className="text-sm text-muted-foreground">—</p>}
          <ReportDetailForm id={r.id} />
        </section>
      </div>
    </div>
  );
}

export default function Page({ params }: { params: Params }) {
  return (
    <div className="space-y-4">
      <Suspense fallback={null}><Back params={params} /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Detail params={params} /></Suspense>
    </div>
  );
}
async function Back({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "cit.reports" });
  return <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/citizen/reports"><ArrowLeft className="size-4" aria-hidden="true" />{t("back")}</Link></Button>;
}
