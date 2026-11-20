import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SpotTheScam, type QuizItem } from "@/components/learn/spot-the-scam";
import { Skeleton } from "@/components/ui/skeleton";
import { GUIDES } from "@/content/learn";
import type { Locale } from "@/i18n/routing";
import { analyze } from "@/server/detection";
import { loadContext } from "@/server/detection/load-context";
import { getQuizPool } from "@/server/queries/public";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "quiz" });
  return { title: t("title"), description: t("description") };
}

async function Game({ locale }: { locale: Locale }) {
  const pool = await getQuizPool();
  let items: QuizItem[];
  if (pool.length >= 4) {
    const ctx = await loadContext();
    items = await Promise.all(
      pool.map(async (p) => {
        const r = await analyze({ kind: "text", text: p.text, channel: p.channel, locale }, ctx);
        return { ...p, why: p.scam ? r.reasons.filter((x) => x.weight > 0).slice(0, 2).map((x) => (locale === "en" ? x.text_en : x.text_sq)) : [] };
      }),
    );
  } else {
    // No dataset yet: guide examples (all scams) keep the game playable.
    items = GUIDES.map((g) => ({ id: g.slug, text: g.example.text[locale], scam: true, channel: g.example.channel, why: g.signs.slice(0, 2).map((s) => s[locale]) }));
  }
  return <SpotTheScam pool={items} />;
}

export default async function QuizPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("quiz");
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
        <Game locale={locale as Locale} />
      </Suspense>
    </div>
  );
}
