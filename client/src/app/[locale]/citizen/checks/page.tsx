import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { DeleteCheckButton, SaveHistoryToggle } from "@/components/citizen/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fmtDateTime } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("checks") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, tc, locale] = await Promise.all([getTranslations("cit.checks"), getTranslations("check"), getLocale()]);
  const { data } = await ctx.supabase.from("user_check_links").select("check_id, kind, created_at, checks(score, flag)").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(500);
  return (
    <div className="space-y-4">
      <SaveHistoryToggle on={ctx.profile.save_history} />
      {!data?.length ? <EmptyState title={t("empty")} action={<Button asChild><Link href="/check">{tc("title")}</Link></Button>} /> : (
        <>
          <div className="flex justify-end"><DeleteCheckButton all /></div>
          {/* Cards on mobile, table-like rows on wider screens (SPEC 8 mobile first) */}
          <ul className="space-y-2">
            {data.map((r) => { const c = r.checks as { score: number; flag: "red" } | null; return (
              <li key={r.check_id} className="glass-card flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm">
                {c && <FlagBadge flag={c.flag} score={c.score} />}
                <span className="font-medium">{t(`kinds.${r.kind as "url"}`)}</span>
                <time className="text-xs text-muted-foreground">{fmtDateTime(r.created_at, locale)}</time>
                <span className="ml-auto flex items-center gap-1"><Button asChild size="sm" variant="outline"><Link href={`/check/${r.check_id}`}>{t("open")}</Link></Button><DeleteCheckButton id={r.check_id} /></span>
              </li>
            ); })}
          </ul>
        </>
      )}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("checks")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
