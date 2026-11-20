import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { InstitutionDirectory } from "@/components/learn/institution-directory";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { getInstitutionDirectory } from "@/server/queries/public";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "institutions" });
  return { title: t("title"), description: t("description") };
}

async function Directory() {
  return <InstitutionDirectory entries={await getInstitutionDirectory()} />;
}

export default async function InstitutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("institutions");
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Directory />
      </Suspense>
      <p className="font-mono text-xs text-muted-foreground">{t("verifyHint")}</p>
    </div>
  );
}
