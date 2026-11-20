import { ArrowRight, Gamepad2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GuideIcon } from "@/components/home/guide-icon";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "learn" });
  return { title: t("title"), description: t("description") };
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("learn");
  const l = locale as Locale;
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/learn/${g.slug}`} className="glass-card group flex h-full flex-col gap-3 rounded-xl p-5 transition-transform hover:-translate-y-0.5">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary"><GuideIcon icon={g.icon} className="size-5" /></span>
              <span className="font-display text-lg font-medium">{g.title[l]}</span>
              <span className="flex-1 text-sm text-muted-foreground">{g.summary[l]}</span>
              <span className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("minutes")}</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">{t("read")} <ArrowRight className="size-4" aria-hidden="true" /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="glass-card flex flex-col items-start gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Gamepad2 className="size-10 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-bold">{t("quizCta")}</h2>
            <p className="text-sm text-muted-foreground">{t("quizBody")}</p>
          </div>
        </div>
        <Button asChild><Link href="/learn/quiz">{t("quizCta")}</Link></Button>
      </div>
    </div>
  );
}
