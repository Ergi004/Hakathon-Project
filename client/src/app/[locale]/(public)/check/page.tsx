import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CheckBox } from "@/components/check/check-box";
import { CheckBoxWithExamples } from "@/components/check/check-box-with-examples";
import { PageHeader } from "@/components/layout/page-header";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "check" });
  return { title: t("title"), description: t("description") };
}

export default async function CheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("check");
  return (
    <div className="bg-grid relative">
      <div aria-hidden="true" className="bg-hero-glow pointer-events-none absolute inset-x-0 top-0 h-96" />
      <div className="relative mx-auto max-w-4xl space-y-8 px-4 py-12 md:px-8">
        <PageHeader title={t("title")} description={t("description")} />
        <Suspense fallback={<CheckBox hero />}>
          <CheckBoxWithExamples hero />
        </Suspense>
      </div>
    </div>
  );
}
