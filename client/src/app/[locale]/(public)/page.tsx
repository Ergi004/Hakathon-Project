import {
  ArrowRight,
  Building2,
  Check,
  ClipboardPaste,
  EyeOff,
  Lock,
  Puzzle,
  ScanSearch,
  ShieldCheck,
  ShieldHalf,
  UserRound,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CheckBox } from "@/components/check/check-box";
import { CheckBoxWithExamples } from "@/components/check/check-box-with-examples";
import { GuideIcon } from "@/components/home/guide-icon";
import { HomeStats, HomeStatsSkeleton } from "@/components/home/home-stats";
import {
  LatestCampaigns,
  LatestCampaignsSkeleton,
} from "@/components/home/latest-campaigns";
import { ScamSpecimen } from "@/components/home/scam-specimen";
import { Section, WIDE } from "@/components/home/section";
import { TrustStrip } from "@/components/home/trust-strip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("home");
  const l = locale as Locale;
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  const assurances = [
    { icon: Lock, key: "private" },
    { icon: EyeOff, key: "anonymous" },
    { icon: ShieldCheck, key: "campaigns" },
  ] as const;
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
      {/* Hero: a calm, centred promise of safety, with the scanner right beneath it */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[42rem] max-w-5xl rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]"
        />
        <div
          className={cn(
            WIDE,
            "relative flex flex-col items-center pt-14 pb-16 text-center md:pt-10 lg:pb-24",
          )}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("eyebrow")}
          </p>
          <h1 className="mt-6  font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl xl:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-[62ch] text-lg text-pretty text-muted-foreground md:text-xl">
            {t("subtitle")}
          </p>
          <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
            {assurances.map(({ icon: Icon, key }) => (
              <li key={key} className="inline-flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-full bg-flag-green/12">
                  <Icon className="size-4 text-flag-green" aria-hidden="true" />
                </span>
                {t(`assure.${key}`)}
              </li>
            ))}
          </ul>
          <div className="mt-10 w-full max-w-5xl text-left">
            <Suspense fallback={<CheckBox hero />}>
              <CheckBoxWithExamples hero />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Live counters */}
      <section
        aria-label={t("stats.title")}
        className="border-b border-border bg-muted/40"
      >
        <div className={cn(WIDE, "py-8")}>
          <Suspense fallback={<HomeStatsSkeleton />}>
            <HomeStats />
          </Suspense>
        </div>
      </section>

      {/* How it works: three steps beside an annotated example of what the scan flags */}
      <Section id="how" title={t("how.title")} subtitle={t("how.subtitle")}>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <ol className="space-y-8 lg:col-span-6">
            {steps.map(({ icon: Icon, key }, i) => (
              <li key={key} className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-primary/40 bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-medium">
                    <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                    {t(`how.${key}.title`)}
                  </h3>
                  <p className="max-w-[52ch] text-muted-foreground">
                    {t(`how.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="lg:col-span-6">
            <ScamSpecimen />
          </div>
        </div>
      </Section>

      {/* Common scams */}
      <div className="border-y border-border bg-muted/40">
        <Section
          id="scams"
          title={t("scams.title")}
          subtitle={t("scams.subtitle")}
          action={
            <Button
              asChild
              variant="outline"
              className="self-start rounded-full"
            >
              <Link href="/learn">
                {t("scams.all")}{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          }
        >
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
            {GUIDES.map((g) => (
              <li key={g.slug} className="bg-background">
                <Link
                  href={`/learn/${g.slug}`}
                  className="group flex h-full gap-4 p-6 transition-colors hover:bg-accent/60"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <GuideIcon icon={g.icon} className="size-5" />
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="font-display text-lg font-medium group-hover:text-primary">
                      {g.title[l]}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {g.summary[l]}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      {t("scams.cta")}{" "}
                      <ArrowRight
                        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
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
          <Button asChild variant="outline" className="self-start rounded-full">
            <Link href="/threats">
              {t("latest.all")}{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        <Suspense fallback={<LatestCampaignsSkeleton />}>
          <LatestCampaigns />
        </Suspense>
      </Section>

      {/* Audiences */}
      <div className="border-y border-border bg-muted/40">
        <Section id="audience" title={t("audience.title")}>
          <div className="grid gap-10 md:grid-cols-3 md:gap-8">
            {audiences.map(({ key, icon: Icon, href }) => (
              <div
                key={key}
                className={cn(
                  "flex flex-col gap-4 border-t-2 pt-6",
                  key === "citizen" ? "border-primary" : "border-border",
                )}
              >
                <Icon className="size-7 text-primary" aria-hidden="true" />
                <h3 className="font-display text-2xl font-medium">
                  {t(`audience.${key}.title`)}
                </h3>
                <p className="max-w-[46ch] flex-1 text-muted-foreground">
                  {t(`audience.${key}.body`)}
                </p>
                <Button
                  asChild
                  variant={key === "citizen" ? "default" : "outline"}
                  className="self-start rounded-full"
                >
                  <Link href={href}>{t(`audience.${key}.cta`)}</Link>
                </Button>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Extension and privacy, side by side */}
      <section className={cn(WIDE, "grid gap-6 py-16 md:py-24 lg:grid-cols-2")}>
        <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 md:p-10">
          <Puzzle className="size-8 text-primary" aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold text-balance sm:text-3xl">
            {t("extension.title")}
          </h2>
          <p className="max-w-[56ch] text-muted-foreground">
            {t("extension.body")}
          </p>
          <ul className="space-y-2.5">
            {(t.raw("extension.points") as string[]).map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm">
                <Check
                  className="size-4 shrink-0 text-flag-green"
                  aria-hidden="true"
                />{" "}
                {p}
              </li>
            ))}
          </ul>
          <Button asChild className="mt-auto self-start rounded-full">
            <Link href="/extension">
              {t("extension.cta")}{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div
          id="privacy"
          className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 md:p-10"
        >
          <Lock className="size-8 text-primary" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-balance sm:text-3xl">
              {t("privacy.title")}
            </h2>
            <p className="text-muted-foreground">{t("privacy.subtitle")}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 font-display font-medium">
                {t("privacy.store")}
              </h3>
              <ul className="space-y-2 text-sm">
                {(t.raw("privacy.storeItems") as string[]).map((s) => (
                  <li key={s} className="flex gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-flag-green"
                      aria-hidden="true"
                    />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-display font-medium">
                {t("privacy.never")}
              </h3>
              <ul className="space-y-2 text-sm">
                {(t.raw("privacy.neverItems") as string[]).map((s) => (
                  <li key={s} className="flex gap-2">
                    <EyeOff
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="mt-auto self-start rounded-full"
          >
            <Link href="/privacy">{t("privacy.cta")}</Link>
          </Button>
        </div>
      </section>

      {/* Most imitated institutions */}
      <section className="border-y border-border bg-muted/40">
        <div
          className={cn(
            WIDE,
            "flex flex-col gap-6 py-12 lg:flex-row lg:items-center lg:gap-12",
          )}
        >
          <div className="shrink-0 space-y-1.5 lg:w-80">
            <h2 className="font-display text-xl font-medium">
              {t("trust.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("trust.body")}</p>
            <Button asChild variant="link" className="h-auto px-0">
              <Link href="/institutions">{t("trust.cta")}</Link>
            </Button>
          </div>
          <div className="flex-1 [&_ul]:justify-start">
            <Suspense fallback={null}>
              <TrustStrip />
            </Suspense>
          </div>
        </div>
      </section>

      {/* FAQ: heading on the left, answers on the right */}
      <section
        id="faq"
        aria-labelledby="faq-title"
        className={cn(WIDE, "grid gap-8 py-16 md:py-24 lg:grid-cols-12")}
      >
        <h2
          id="faq-title"
          className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:sticky lg:top-24 lg:col-span-4 lg:self-start"
        >
          {t("faq.title")}
        </h2>
        <Accordion type="single" collapsible className="lg:col-span-8">
          {faq.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`}>
              <AccordionTrigger className="py-5 text-left text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="max-w-[70ch] text-base text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final call to action */}
      <section className={cn(WIDE, "pb-16 md:pb-24")}>
        <div className="flex flex-col gap-8 rounded-3xl bg-primary px-6 py-12 text-primary-foreground md:px-12 md:py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-3xl font-bold text-balance sm:text-4xl">
              {t("final.title")}
            </h2>
            <p className="text-lg opacity-85">{t("final.body")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full"
            >
              <Link href="/check">{t("final.check")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:border-primary-foreground/40 dark:bg-transparent dark:hover:bg-primary-foreground/10"
            >
              <Link href="/report">{t("final.report")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
