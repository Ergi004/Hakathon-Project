import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Lightbulb } from "lucide-react";
import { AssetManager } from "@/components/business/forms";
import { DashPage } from "@/components/layout/dash";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("onboarding") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const [t, tb] = await Promise.all([getTranslations("biz.onboarding"), getTranslations("biz")]);
  const { data } = await ctx.supabase.from("brand_assets").select("id, kind, value, verified_at").eq("org_id", ctx.org.id).order("kind");
  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8"><AssetManager assets={data ?? []} canEdit={["owner", "admin"].includes(ctx.orgRole)} /></div>
      <aside className="space-y-6 xl:sticky xl:top-20 xl:col-span-4">
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader><CardTitle className="inline-flex items-center gap-2 font-display text-lg"><Lightbulb className="size-5 text-primary" aria-hidden="true" />{tb("ob.why")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{tb("ob.whyBody")}</p>
            <p>{t("verifyNote")}</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("onboarding")} subtitle={tb("pages.onboarding")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
