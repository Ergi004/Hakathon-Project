import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ReportWizard } from "@/components/report/report-wizard";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "report" });
  return { title: t("title"), description: t("description") };
}

async function Wizard() {
  const session = await getSessionUser();
  return <ReportWizard signedIn={!!session} />;
}

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("report");
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<ReportWizard signedIn={false} />}>
        <Wizard />
      </Suspense>
    </div>
  );
}
