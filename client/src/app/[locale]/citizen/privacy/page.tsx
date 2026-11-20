import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { PrivacyActions } from "@/components/citizen/forms";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("privacy") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, locale] = await Promise.all([getTranslations("cit.privacy"), getLocale()]);
  const { data } = await ctx.supabase.from("consent_log").select("id, kind, granted, created_at").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(100);
  return (
    <div className="space-y-6">
      <PrivacyActions />
      <section className="glass-card space-y-3 rounded-xl p-4">
        <h2 className="font-medium">{t("consents")}</h2>
        {!data?.length ? <p className="text-sm text-muted-foreground">{t("noConsents")}</p> : (
          <ul className="space-y-1.5 text-sm">
            {data.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-2"><span>{t.has(`kinds.${c.kind}` as "kinds.terms") ? t(`kinds.${c.kind}` as "kinds.terms") : c.kind}</span><Badge variant={c.granted ? "default" : "outline"}>{c.granted ? t("granted") : t("withdrawn")}</Badge><span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(c.created_at, locale)}</span></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("privacy")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
