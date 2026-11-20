import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { CitizenSettingsForm } from "@/components/citizen/forms";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("settings") };
}

async function Content() {
  const ctx = await requireUser();
  const t = await getTranslations("cit.settings");
  const p = ctx.profile;
  const methods = (ctx.user.identities ?? []).map((i) => i.provider);
  return (
    <div className="space-y-5">
      <CitizenSettingsForm name={p.full_name ?? ""} locale={p.locale as "sq" | "en"} notifyEmail={p.notify_email} notifyInApp={p.notify_in_app} />
      <section className="glass-card max-w-xl space-y-2 rounded-xl p-5">
        <h2 className="font-medium">{t("methods")}</h2>
        <div className="flex flex-wrap gap-2">{(methods.length ? methods : ["email"]).map((m) => <Badge key={m} variant="secondary">{m}</Badge>)}</div>
        <p className="font-mono text-xs text-muted-foreground">{ctx.user.email}</p>
      </section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("settings")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
