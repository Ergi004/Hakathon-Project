import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { FamilyCard, type CardCopy } from "@/components/citizen/forms";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("family") };
}

async function Content() {
  await requireUser();
  // The card can be printed in either language, independent of the UI language.
  const copy = Object.fromEntries(
    await Promise.all(
      (["sq", "en"] as const).map(async (l) => {
        const t = await getTranslations({ locale: l, namespace: "cit.family" });
        return [l, { cardTitle: t("cardTitle"), cardFor: t.raw("cardFor") as string, rules: t.raw("rules") as string[], emergency: t("emergency") }] as const;
      }),
    ),
  ) as Record<"sq" | "en", CardCopy>;
  return <FamilyCard copy={copy} />;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.family");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}><Content /></Suspense>
    </div>
  );
}
