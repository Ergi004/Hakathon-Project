import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { EmptyState } from "@/components/layout/empty-state";
import { FlagBadge } from "@/components/flags/flag-badge";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fmtDateTime } from "@/lib/format";
import { PUBLIC_STATUS_ORDER } from "@/server/reports";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("reports") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, ts, tr, locale] = await Promise.all([getTranslations("cit.reports"), getTranslations("reportStatus"), getTranslations("home.final"), getLocale()]);
  const { data } = await ctx.supabase.from("reports").select("id, protocol, status, flag, score, created_at, resolution_note").eq("reporter_id", ctx.user.id).order("created_at", { ascending: false });
  if (!data?.length) return <EmptyState title={t("empty")} action={<Button asChild><Link href="/report">{tr("report")}</Link></Button>} />;
  return (
    <ul className="space-y-3">
      {data.map((r) => {
        const idx = PUBLIC_STATUS_ORDER.indexOf(r.status);
        return (
          <li key={r.id} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2"><Link href={`/citizen/reports/${r.id}`} className="font-mono text-sm hover:underline">{r.protocol}</Link>{r.flag && <FlagBadge flag={r.flag} score={r.score} />}<span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(r.created_at, locale)}</span></div>
            {idx === -1 ? <p className="text-sm">{ts(r.status)}</p> : <StatusTimeline orientation="horizontal" steps={PUBLIC_STATUS_ORDER.map((s, i) => ({ key: s, label: ts(s), state: i < idx ? "done" : i === idx ? (s === "taken_down" ? "done" : "current") : "pending" }))} />}
            {r.resolution_note && r.resolution_note !== "need_more_info" && <p className="text-sm text-muted-foreground">{t("outcome")}: {r.resolution_note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("reports")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
