import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { OrgSettingsForm } from "@/components/business/forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("settings") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin"]));
  const { data } = await ctx.supabase.from("organizations").select("name, plan, notification_emails, retention_days").eq("id", ctx.org.id).single();
  return <OrgSettingsForm name={data?.name ?? ctx.org.name} emails={data?.notification_emails ?? []} retention={data?.retention_days ?? 365} plan={data?.plan ?? "free"} canEdit />;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("settings")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
