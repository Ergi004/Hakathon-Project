import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { LegalDoc } from "@/content/legal";
import type { Locale } from "@/i18n/routing";
import { fmtDate } from "@/lib/format";

export async function LegalPage({ doc, locale }: { doc: LegalDoc; locale: Locale }) {
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 md:px-8">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{doc.title[locale]}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{t("lastUpdated", { date: fmtDate(doc.updated, locale) })}</span>
          {doc.draft && <Badge variant="outline">{t("draft")}</Badge>}
        </div>
        <p className="text-lg text-muted-foreground">{doc.intro[locale]}</p>
      </header>
      {doc.sections.map((s) => (
        <section key={s.heading.en} className="space-y-2">
          <h2 className="font-display text-xl font-medium">{s.heading[locale]}</h2>
          {s.body.length > 1 ? (
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">{s.body.map((b) => <li key={b.en}>{b[locale]}</li>)}</ul>
          ) : (
            <p className="text-muted-foreground">{s.body[0][locale]}</p>
          )}
        </section>
      ))}
    </article>
  );
}
