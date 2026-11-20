import { ArrowRight, Fingerprint } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("public.home");

  return (
    <section className="bg-grid relative overflow-hidden border-b border-border">
      <div aria-hidden="true" className="bg-hero-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center md:px-8 md:py-28">
        <LogoMark className="size-14" animated />
        <p className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{t("subtitle")}</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="shadow-[0_0_40px_-8px_var(--glow)]">
            <Link href="/check">
              {t("ctaCheck")} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/report">{t("ctaReport")}</Link>
          </Button>
        </div>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Fingerprint className="size-4" aria-hidden="true" />
          {t("privacyNote")}
        </p>
      </div>
    </section>
  );
}
