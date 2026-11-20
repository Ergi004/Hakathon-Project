import { ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GuideIcon } from "@/components/home/guide-icon";
import { GuideQuiz } from "@/components/learn/guide-quiz";
import { MaskedText } from "@/components/shared/masked-text";
import { Button } from "@/components/ui/button";
import { getGuide, GUIDES } from "@/content/learn";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

type Params = Promise<{ locale: string; slug: string }>;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => GUIDES.map((g) => ({ locale, slug: g.slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = getGuide(slug);
  return g ? { title: g.title[locale as Locale], description: g.summary[locale as Locale] } : {};
}

export default async function GuidePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const g = getGuide(slug);
  if (!g) notFound();
  const t = await getTranslations("learn");
  const tc = await getTranslations("channel");
  const l = locale as Locale;

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 md:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/learn"><ArrowLeft className="size-4" aria-hidden="true" /> {t("allGuides")}</Link></Button>
      <header className="space-y-3">
        <span className="grid size-12 place-items-center rounded-xl bg-primary/12 text-primary"><GuideIcon icon={g.icon} className="size-6" /></span>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{g.title[l]}</h1>
        <p className="text-lg text-muted-foreground">{g.summary[l]}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">{t("example")}</h2>
        <div className="glass-card space-y-2 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{tc(g.example.channel)} · {t("from")}: <span className="font-mono">{g.example.sender}</span></p>
          <MaskedText text={g.example.text[l]} highlights={l === "sq" ? ["sot", "brenda 24 orëve", "OTP", "tarifë", "pezullua", "Paguani"] : ["today", "within 24 hours", "OTP", "fee", "suspended", "Pay"]} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">{t("signs")}</h2>
        <ul className="space-y-2">
          {g.signs.map((s) => (
            <li key={s.en} className="flex gap-2 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0 text-flag-orange" aria-hidden="true" />{s[l]}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">{t("todo")}</h2>
        <ul className="space-y-2">
          {g.todo.map((s) => (
            <li key={s.en} className="flex gap-2 text-sm"><CircleCheck className="mt-0.5 size-4 shrink-0 text-flag-green" aria-hidden="true" />{s[l]}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">{t("quiz")}</h2>
        <GuideQuiz guide={g} />
      </section>

      <nav aria-label={t("otherGuides")} className="space-y-3 border-t border-border pt-6">
        <h2 className="font-display text-lg font-medium">{t("otherGuides")}</h2>
        <ul className="flex flex-wrap gap-2">
          {GUIDES.filter((x) => x.slug !== g.slug).map((x) => (
            <li key={x.slug}><Button asChild variant="outline" size="sm"><Link href={`/learn/${x.slug}`}>{x.title[l]}</Link></Button></li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
