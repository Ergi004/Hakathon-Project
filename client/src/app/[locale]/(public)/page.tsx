import { ArrowRight, Building2, Check, ClipboardPaste, EyeOff, Lock, Puzzle, ScanSearch, ShieldCheck, ShieldHalf, UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo";
import { CheckBox } from "@/components/check/check-box";
import { CheckBoxWithExamples } from "@/components/check/check-box-with-examples";
import { GuideIcon } from "@/components/home/guide-icon";
import { HomeStats, HomeStatsSkeleton } from "@/components/home/home-stats";
import { LatestCampaigns, LatestCampaignsSkeleton } from "@/components/home/latest-campaigns";
import { Section } from "@/components/home/section";
import { TrustStrip } from "@/components/home/trust-strip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("home");
  const l = locale as Locale;
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  const steps = [
    { icon: ClipboardPaste, key: "s1" },
    { icon: ScanSearch, key: "s2" },
    { icon: ShieldCheck, key: "s3" },
  ] as const;
  const audiences = [
    { key: "citizen", icon: UserRound, href: "/register" },
    { key: "business", icon: Building2, href: "/register?type=business" },
    { key: "authorities", icon: ShieldHalf, href: "/login" },
  ] as const;

  return (
    <>
      {/* Hero with the command-bar checker */}
      <section className="bg-grid relative overflow-hidden border-b border-border">
        <div aria-hidden="true" className="bg-hero-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl space-y-8 px-4 pt-14 pb-16 md:px-8 md:pt-20 md:pb-24">
          <div className="flex flex-col items-center gap-5 text-center">
            <LogoMark className="size-14" animated />
            <p className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">{t("eyebrow")}</p>
            <h1 className="font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">{t("title")}</h1>
            <p className="max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">{t("subtitle")}</p>
          </div>
          <Suspense fallback={<CheckBox hero />}>
            <CheckBoxWithExamples hero />
          </Suspense>
        </div>
      </section>

      {/* Live counters */}
      <section aria-label={t("stats.title")} className="mx-auto max-w-6xl px-4 pt-12 md:px-8">
        <Suspense fallback={<HomeStatsSkeleton />}>
          <HomeStats />
        </Suspense>
      </section>

      {/* How it works */}
      <Section id="how" title={t("how.title")} subtitle={t("how.subtitle")}>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, key }, i) => (
            <li key={key} className="glass-card relative rounded-xl p-6">
              <span className="absolute top-4 right-5 font-display text-4xl font-bold text-muted-foreground/25" aria-hidden="true">{i + 1}</span>
              <Icon className="mb-4 size-7 text-primary" aria-hidden="true" />
              <h3 className="mb-1.5 font-display text-lg font-medium">{t(`how.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`how.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Common scams */}
      <div className="border-y border-border bg-muted/30">
        <Section
          id="scams"
          title={t("scams.title")}
          subtitle={t("scams.subtitle")}
          action={
            <Button asChild variant="outline">
              <Link href="/learn">{t("scams.all")} <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/learn/${g.slug}`} className="glass-card group flex h-full flex-col gap-3 rounded-xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
                  <span className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary">
                    <GuideIcon icon={g.icon} className="size-5" />
                  </span>
                  <span className="font-display text-lg font-medium">{g.title[l]}</span>
                  <span className="flex-1 text-sm text-muted-foreground">{g.summary[l]}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    {t("scams.cta")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* Latest campaigns */}
      <Section
        id="latest"
        title={t("latest.title")}
        subtitle={t("latest.subtitle")}
        action={
          <Button asChild variant="outline">
            <Link href="/threats">{t("latest.all")} <ArrowRight className="size-4" aria-hidden="true" /></Link>
          </Button>
        }
      >
        <Suspense fallback={<LatestCampaignsSkeleton />}>
          <LatestCampaigns />
        </Suspense>
      </Section>

      {/* Audiences */}
      <div className="border-y border-border bg-muted/30">
        <Section id="audience" title={t("audience.title")}>
          <div className="grid gap-4 md:grid-cols-3">
            {audiences.map(({ key, icon: Icon, href }) => (
              <div key={key} className="glass-card flex flex-col gap-3 rounded-xl p-6">
                <Icon className="size-7 text-primary" aria-hidden="true" />
                <h3 className="font-display text-xl font-medium">{t(`audience.${key}.title`)}</h3>
                <p className="flex-1 text-sm text-muted-foreground">{t(`audience.${key}.body`)}</p>
                <Button asChild variant={key === "citizen" ? "default" : "outline"} className="self-start">
                  <Link href={href}>{t(`audience.${key}.cta`)}</Link>
                </Button>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Extension */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20">
        <div className="glass-card grid items-center gap-8 overflow-hidden rounded-2xl p-6 md:grid-cols-[1.4fr_1fr] md:p-10">
          <div className="space-y-4">
            <Puzzle className="size-8 text-primary" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("extension.title")}</h2>
            <p className="text-muted-foreground">{t("extension.body")}</p>
            <Button asChild>
              <Link href="/extension">{t("extension.cta")} <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          </div>
          <ul className="space-y-3">
            {(t.raw("extension.points") as string[]).map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3 text-sm">
                <Check className="size-4 shrink-0 text-flag-green" aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Privacy by design */}
      <div className="border-y border-border bg-muted/30">
        <Section id="privacy" title={t("privacy.title")} subtitle={t("privacy.subtitle")} action={<Button asChild variant="outline"><Link href="/privacy">{t("privacy.cta")}</Link></Button>}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-medium"><Lock className="size-5 text-primary" aria-hidden="true" />{t("privacy.store")}</h3>
              <ul className="space-y-2 text-sm">
                {(t.raw("privacy.storeItems") as string[]).map((s) => (
                  <li key={s} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-flag-green" aria-hidden="true" />{s}</li>
                ))}
              </ul>
            </div>
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-medium"><EyeOff className="size-5 text-primary" aria-hidden="true" />{t("privacy.never")}</h3>
              <ul className="space-y-2 text-sm">
                {(t.raw("privacy.neverItems") as string[]).map((s) => (
                  <li key={s} className="flex gap-2"><EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      </div>

      {/* Trust strip */}
      <section className="mx-auto max-w-6xl space-y-5 px-4 py-14 text-center md:px-8">
        <h2 className="font-display text-xl font-medium">{t("trust.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("trust.body")}</p>
        <Suspense fallback={null}>
          <TrustStrip />
        </Suspense>
        <Button asChild variant="link"><Link href="/institutions">{t("trust.cta")}</Link></Button>
      </section>

      {/* FAQ */}
      <div className="border-t border-border">
        <Section id="faq" title={t("faq.title")} className="max-w-3xl">
          <Accordion type="single" collapsible className="glass-card rounded-xl px-4">
            {faq.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>
      </div>

      {/* Final CTA */}
      <section className="bg-grid relative overflow-hidden border-t border-border">
        <div aria-hidden="true" className="bg-hero-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-20 text-center">
          <h2 className="font-display text-3xl font-bold text-balance sm:text-4xl">{t("final.title")}</h2>
          <p className="text-muted-foreground">{t("final.body")}</p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg"><Link href="/check">{t("final.check")}</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/report">{t("final.report")}</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
