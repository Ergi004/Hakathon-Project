import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "@/i18n/navigation";
import { SpotTheScam } from "@/components/learn/spot-the-scam";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { getQuizItems } from "@/server/queries/quiz";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "quiz" });
  return { title: t("title"), description: t("description") };
}

async function Game({ locale }: { locale: Locale }) {
  return <SpotTheScam pool={await getQuizItems(locale)} />;
}

export default async function QuizPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, tl] = await Promise.all([getTranslations("quiz"), getTranslations("learn")]);
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pt-8 pb-20 md:px-8 md:pt-10">
      <div className="space-y-5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/learn">{tl("title")}</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <header className="space-y-3">
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{t("title")}</h1>
          <p className="text-lg text-muted-foreground">{t("description")}</p>
        </header>
      </div>
      <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-2xl" />}>
        <Game locale={locale as Locale} />
      </Suspense>
    </div>
  );
}
