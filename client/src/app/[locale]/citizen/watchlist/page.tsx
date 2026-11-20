import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { AtSign, CircleCheck, Eye, Fingerprint, Phone, ShieldAlert, UserRound, type LucideIcon } from "lucide-react";
import { RemoveWatchButton, WatchForm } from "@/components/citizen/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";

const KIND_ICON: Record<string, LucideIcon> = { phone: Phone, email: AtSign, name: UserRound };
const HOW_ICON = [Eye, Fingerprint, ShieldAlert] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("watchlist") };
}

async function WatchList() {
  const ctx = await requireUser();
  const [t, locale] = await Promise.all([getTranslations("cit.watch"), getLocale()]);
  const { data } = await ctx.supabase.from("user_watch_items").select("id, kind, label, last_match_at, created_at").eq("user_id", ctx.user.id).order("created_at", { ascending: false });
  const items = data ?? [];
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border py-5">
        <CardTitle className="font-display text-lg">{t("watching", { count: items.length })}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!items.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted"><Eye className="size-6 text-muted-foreground" aria-hidden="true" /></span>
            <p className="font-medium">{t("empty")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((w) => {
              const Icon = KIND_ICON[w.kind] ?? Eye;
              const hit = !!w.last_match_at;
              return (
                <li key={w.id} className="flex items-center gap-4 px-5 py-4">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", hit ? "bg-flag-orange/15 text-flag-orange" : "bg-primary/12 text-primary")}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[0.95rem]">{w.label}</p>
                    <p className="text-xs text-muted-foreground">{t(`kinds.${w.kind as "phone"}`)}</p>
                  </div>
                  {hit ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-flag-orange/40 bg-flag-orange/10 px-2.5 py-1 text-xs font-medium">
                      <ShieldAlert className="size-3.5 text-flag-orange" aria-hidden="true" />
                      {t("matched", { ago: fmtAgo(w.last_match_at!, locale) })}
                    </span>
                  ) : (
                    <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                      <CircleCheck className="size-3.5 text-flag-green" aria-hidden="true" />
                      {t("safe")}
                    </span>
                  )}
                  <RemoveWatchButton id={w.id} label={w.label} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.watch");
  const how = t.raw("how") as { title: string; body: string }[];
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">{t("addTitle")}</CardTitle>
            </CardHeader>
            <CardContent><WatchForm /></CardContent>
          </Card>
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}><WatchList /></Suspense>
        </div>
        <aside className="lg:sticky lg:top-20 lg:col-span-5 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">{t("howTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-5">
                {how.map((s, i) => {
                  const Icon = HOW_ICON[i] ?? Eye;
                  return (
                    <li key={s.title} className="flex gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-primary/40 bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-sm text-muted-foreground">{s.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
