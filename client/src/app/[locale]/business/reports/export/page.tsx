import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { ExportForm } from "@/components/business/forms";
import { DashPage } from "@/components/layout/dash";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("export") };
}

async function Content() {
  await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "finance"]));
  const tb = await getTranslations("biz");
  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8"><ExportForm /></div>
      <Card className="xl:col-span-4">
        <CardHeader><CardTitle className="font-display text-lg">{tb("ex.includesTitle")}</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {(tb.raw("ex.includes") as string[]).map((s) => (
              <li key={s} className="flex gap-3 text-sm"><CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{s}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("export")} subtitle={tb("pages.export")}>
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
