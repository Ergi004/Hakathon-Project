import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { CheckResult } from "@/components/check/check-result";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { fmtDateTime } from "@/lib/format";
import type { Reason } from "@/server/detection/types";
import { getPublicCheck } from "@/server/queries/public";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "check" });
  return { title: t("resultTitle"), robots: { index: false } };
}

async function StoredResult({ params }: { params: Params }) {
  const { id, locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("check");
  const row = z.uuid().safeParse(id).success ? await getPublicCheck(id) : null;
  if (!row) return <EmptyState title={t("notFound")} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("checkedAt", { date: fmtDateTime(row.created_at, locale) })} · {t("storedNote")}
      </p>
      <CheckResult
        result={{
          score: row.score,
          flag: row.flag,
          reasons: (row.reasons as unknown as Reason[]) ?? [],
          campaign: row.campaigns ? { code: (row.campaigns as { code: string }).code } : null,
        }}
        checkId={row.id}
      />
    </div>
  );
}

async function Title({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "check" });
  return <PageHeader title={t("resultTitle")} />;
}

export default function StoredCheckPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 md:px-8">
      <Suspense fallback={<Skeleton className="h-9 w-64" />}>
        <Title params={params} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <StoredResult params={params} />
      </Suspense>
    </div>
  );
}
