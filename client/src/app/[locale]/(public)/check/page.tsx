import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CheckBox } from "@/components/check/check-box";
import { CheckBoxWithExamples } from "@/components/check/check-box-with-examples";
import { Check } from "lucide-react";
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
    <div className="relative">
      <div aria-hidden="true" className="bg-hero-glow pointer-events-none absolute inset-x-0 top-0 h-96" />
      <div className="relative mx-auto max-w-5xl space-y-8 px-4 pt-10 pb-20 md:px-8 md:pt-16">
        <header className="space-y-4">
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">{t("title")}</h1>
          <p className="max-w-[62ch] text-lg text-pretty text-muted-foreground">{t("description")}</p>
          <ul className="flex flex-wrap gap-y-2 text-sm">
            {(t.raw("trust") as string[]).map((item) => (
              <li key={item} className="mr-6 flex items-center gap-2">
                <Check className="size-4 shrink-0 text-flag-green" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </header>
        <Suspense fallback={<CheckBox hero />}>
          <CheckBoxWithExamples hero />
        </Suspense>
      </div>
    </div>
  );
}
