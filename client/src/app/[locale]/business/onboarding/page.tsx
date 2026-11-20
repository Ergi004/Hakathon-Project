import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { AssetManager } from "@/components/business/forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("onboarding") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const t = await getTranslations("biz.onboarding");
  const { data } = await ctx.supabase.from("brand_assets").select("id, kind, value, verified_at").eq("org_id", ctx.org.id).order("kind");
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("intro")}</p>
      <AssetManager assets={data ?? []} canEdit={["owner", "admin"].includes(ctx.orgRole)} />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("onboarding")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
