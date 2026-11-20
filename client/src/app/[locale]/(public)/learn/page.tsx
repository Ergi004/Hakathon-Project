import { ArrowRight, CircleAlert, Clock, Gamepad2, KeyRound, Keyboard, ListChecks, ScanSearch, Timer } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GuideIcon } from "@/components/home/guide-icon";
import { WIDE } from "@/components/home/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const RULE_ICONS = [KeyRound, Keyboard, Timer] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "learn" });
  return { title: t("title"), description: t("description") };
}

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, tch, tf] = await Promise.all([getTranslations("learn"), getTranslations("channel"), getTranslations("home.final")]);
  const l = locale as Locale;
  const rules = t.raw("rules") as { title: string; body: string }[];

  return (
    <div className={cn(WIDE, "space-y-14 pt-10 pb-20 md:pt-14")}>
      {/* Header with the quiz as the hands-on way in */}
      <header className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <div className="space-y-4 lg:col-span-7">
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">{t("title")}</h1>
          <p className="max-w-[60ch] text-lg text-muted-foreground">{t("description")}</p>
        </div>
        <Card className="relative overflow-hidden border-primary/30 bg-primary/5 ring-primary/20 lg:col-span-5">
          <CardContent className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Gamepad2 className="size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="font-display text-lg font-bold">{t("quizCta")}</h2>
              <p className="text-sm text-muted-foreground">{t("quizBody")}</p>
            </div>
            <Button asChild size="icon" className="shrink-0 rounded-full" aria-label={t("quizCta")}>
              <Link href="/learn/quiz" className="after:absolute after:inset-0"><ArrowRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          </CardContent>
        </Card>
      </header>

      {/* The three rules that apply to every guide */}
      <section aria-labelledby="rules-title" className="space-y-5">
        <h2 id="rules-title" className="font-display text-2xl font-bold tracking-tight">{t("rulesTitle")}</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {rules.map((r, i) => {
            const Icon = RULE_ICONS[i] ?? CircleAlert;
            return (
              <li key={r.title} className="flex gap-4 rounded-2xl border border-border bg-muted/40 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-flag-orange/14 text-flag-orange">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <h3 className="font-display font-medium">
                    <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                    {r.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Guides: each card previews the scam it teaches */}
      <section aria-labelledby="guides-title" className="space-y-5">
        <h2 id="guides-title" className="font-display text-2xl font-bold tracking-tight">{t("guidesTitle")}</h2>
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Card className="group/guide relative h-full gap-4 transition-shadow focus-within:ring-2 focus-within:ring-ring hover:ring-primary/40">
                <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
                  <span className="row-span-2 grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
                    <GuideIcon icon={g.icon} className="size-5" />
                  </span>
                  <CardTitle className="font-display text-lg">
                    <Link href={`/learn/${g.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">{g.title[l]}</Link>
                  </CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="font-normal">{tch(g.example.channel)}</Badge>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <p className="text-sm text-muted-foreground">{g.summary[l]}</p>
                  {/* Masked, defanged excerpt of the guide's example */}
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5" aria-hidden="true">
                    <p className="mb-1 font-mono text-[0.7rem] text-muted-foreground">{g.example.sender}</p>
                    <p className="line-clamp-2 text-sm">{g.example.text[l]}</p>
                  </div>
                </CardContent>

                <Separator />
                <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" aria-hidden="true" />{t("minutes")}</span>
                    <span className="inline-flex items-center gap-1.5"><CircleAlert className="size-3.5" aria-hidden="true" />{t("signsCount", { count: g.signs.length })}</span>
                    <span className="inline-flex items-center gap-1.5"><ListChecks className="size-3.5" aria-hidden="true" />{t("quizQuestions", { count: g.quiz.length })}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    {t("read")}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover/guide:translate-x-0.5" aria-hidden="true" />
                  </span>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Hand-off to the checker */}
      <Card className="py-0">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div className="flex items-center gap-4">
            <ScanSearch className="size-9 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-bold">{t("checkTitle")}</h2>
              <p className="text-muted-foreground">{t("checkBody")}</p>
            </div>
          </div>
          <Button asChild size="lg" className="rounded-full">
            <Link href="/check">{tf("check")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
