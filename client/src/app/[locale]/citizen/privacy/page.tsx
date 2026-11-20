import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Bell, CircleCheck, CircleSlash, Eye, EyeOff, FileText, ScanSearch, ScrollText, TriangleAlert } from "lucide-react";
import { DeleteAccountButton, ExportDataButton } from "@/components/citizen/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("privacy") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, locale] = await Promise.all([getTranslations("cit.privacy"), getLocale()]);
  const uid = ctx.user.id;
  const [consents, checks, reports, watch] = await Promise.all([
    ctx.supabase.from("consent_log").select("id, kind, granted, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("user_check_links").select("check_id", { count: "exact", head: true }).eq("user_id", uid),
    ctx.supabase.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", uid),
    ctx.supabase.from("user_watch_items").select("id", { count: "exact", head: true }).eq("user_id", uid),
  ]);
  const log = consents.data ?? [];
  const keep = [
    { k: "checks", v: checks.count ?? 0, Icon: ScanSearch },
    { k: "reports", v: reports.count ?? 0, Icon: FileText },
    { k: "watch", v: watch.count ?? 0, Icon: Eye },
    { k: "consents", v: log.length, Icon: ScrollText },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="font-display text-lg">{t("keepTitle")}</CardTitle>
            <CardDescription>{t("exportHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {keep.map(({ k, v, Icon }) => (
                <li key={k} className="rounded-xl border border-border p-3">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                  <p className="mt-2 font-display text-2xl leading-none font-bold">{v}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`keep.${k}`)}</p>
                </li>
              ))}
            </ul>
            <ExportDataButton />
          </CardContent>
        </Card>
        <Card className="border-flag-green/30 lg:col-span-5">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-display text-lg"><EyeOff className="size-5 text-flag-green" aria-hidden="true" />{t("neverTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(t.raw("never") as string[]).map((s) => (
                <li key={s} className="flex gap-3 text-sm"><CircleCheck className="mt-0.5 size-4 shrink-0 text-flag-green" aria-hidden="true" />{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border py-5">
          <CardTitle className="font-display text-lg">{t("consents")}</CardTitle>
          <CardDescription>{t("consentsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!log.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("noConsents")}</p>
          ) : (
            <ol className="divide-y divide-border">
              {log.map((c) => {
                const label = t.has(`kinds.${c.kind}` as "kinds.terms") ? t(`kinds.${c.kind}` as "kinds.terms") : c.kind;
                const Icon = c.kind === "notify_email" ? Bell : c.granted ? CircleCheck : CircleSlash;
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", c.granted ? "bg-flag-green/12 text-flag-green" : "bg-muted text-muted-foreground")}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="font-medium">{label}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs", c.granted ? "border-flag-green/40 text-flag-green" : "border-border text-muted-foreground")}>
                      {c.granted ? t("granted") : t("withdrawn")}
                    </span>
                    <time dateTime={c.created_at} className="ml-auto text-xs text-muted-foreground">{fmtDateTime(c.created_at, locale)}</time>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="danger" className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 id="danger" className="inline-flex items-center gap-2 font-display text-lg font-medium"><TriangleAlert className="size-5 text-destructive" aria-hidden="true" />{t("dangerTitle")}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{t("deleteHint")}</p>
          </div>
          <DeleteAccountButton />
        </div>
      </section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.privacy");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </div>
  );
}
