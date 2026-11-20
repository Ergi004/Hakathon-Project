import { Check, Download, EyeOff, KeyRound, ListChecks, Send, ShieldCheck } from "lucide-react";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "extensionPage" });
  return { title: t("title"), description: t("description") };
}

export default async function ExtensionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("extensionPage");
  // Workers serve public/ via ASSETS; existsSync is a local-dev convenience only.
  const hasZip = existsSync(path.join(process.cwd(), "public", "downloads", "mburoja-extension.zip"));

  const list = (key: string) => t.raw(key) as string[];
  const card = (icon: React.ReactNode, title: string, items: string[], tone: "ok" | "no" = "ok") => (
    <section className="glass-card space-y-3 rounded-xl p-5">
      <h2 className="inline-flex items-center gap-2 font-display text-lg font-medium">{icon}{title}</h2>
      <ul className="space-y-2 text-sm">
        {items.map((s) => (
          <li key={s} className="flex gap-2">
            {tone === "ok" ? <Check className="mt-0.5 size-4 shrink-0 text-flag-green" aria-hidden="true" /> : <EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8">
      <PageHeader title={t("title")} description={t("description")} actions={
        hasZip ? <Button asChild><a href="/downloads/mburoja-extension.zip" download><Download className="size-4" aria-hidden="true" /> {t("download")}</a></Button> : undefined
      } />
      <section className="glass-card space-y-4 rounded-xl p-5 md:p-6">
        <h2 className="font-display text-xl font-medium">{t("install")}</h2>
        <ol className="grid gap-3 md:grid-cols-4">
          {list("installSteps").map((s, i) => (
            <li key={s} className="rounded-lg border border-border p-4 text-sm">
              <span className="mb-2 grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">{t("downloadNote")}</p>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {card(<ShieldCheck className="size-5 text-primary" aria-hidden="true" />, t("reads"), list("readsItems"))}
        {card(<EyeOff className="size-5 text-primary" aria-hidden="true" />, t("never"), list("neverItems"), "no")}
        {card(<Send className="size-5 text-primary" aria-hidden="true" />, t("signal"), list("signalItems"))}
        {card(<KeyRound className="size-5 text-primary" aria-hidden="true" />, t("permissions"), list("permissionsItems"))}
      </div>
      <section className="glass-card space-y-3 rounded-xl p-5 md:p-6">
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-medium"><ListChecks className="size-5 text-primary" aria-hidden="true" />{t("consent")}</h2>
        <p className="text-sm text-muted-foreground">{t("consentBody")}</p>
        <Button asChild variant="outline"><Link href="/citizen/extension">{t("manage")}</Link></Button>
      </section>
    </div>
  );
}
