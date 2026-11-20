import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SimulationManager } from "@/components/business/forms";
import { DashPage } from "@/components/layout/dash";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("training") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security", "comms"]));
  const { data } = await ctx.supabase.from("simulations").select("id, name, template_key, status, sent, opened, clicked, reported, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false });
  return <SimulationManager sims={data ?? []} canEdit={["owner", "admin", "security"].includes(ctx.orgRole)} />;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("training")} subtitle={tb("pages.training")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
