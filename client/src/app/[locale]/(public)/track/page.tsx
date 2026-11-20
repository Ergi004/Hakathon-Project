import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { TrackForm } from "@/components/report/track-form";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "track" });
  return { title: t("title"), robots: { index: false } };
}

async function WithProtocol({ searchParams }: { searchParams: Promise<{ protocol?: string | string[] }> }) {
  const { protocol } = await searchParams;
  return <TrackForm initialProtocol={typeof protocol === "string" ? protocol.slice(0, 20) : ""} />;
}

export default async function TrackPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ protocol?: string | string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("track");
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<TrackForm />}>
        <WithProtocol searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
