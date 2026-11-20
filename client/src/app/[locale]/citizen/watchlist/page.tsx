import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { RemoveWatchButton, WatchForm } from "@/components/citizen/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { fmtAgo } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("watchlist") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, locale] = await Promise.all([getTranslations("cit.watch"), getLocale()]);
  const { data } = await ctx.supabase.from("user_watch_items").select("id, kind, label, last_match_at, created_at").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("intro")}</p>
      <WatchForm />
      {!data?.length ? <EmptyState title={t("empty")} /> : (
        <ul className="space-y-2">
          {data.map((w) => (
            <li key={w.id} className="glass-card flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm">
              <Badge variant="secondary">{t(`kinds.${w.kind as "phone"}`)}</Badge>
              <span className="font-mono">{w.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{t("lastMatch")}: {w.last_match_at ? fmtAgo(w.last_match_at, locale) : t("never")}</span>
              <RemoveWatchButton id={w.id} label={w.label} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("watchlist")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
