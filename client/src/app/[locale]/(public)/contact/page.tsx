import { Lock, Mail, Megaphone, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "legal" });
  return { title: t("contactTitle") };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("legal");
  const tr = await getTranslations("home.final");
  const items = [
    { key: "general", icon: Mail, email: "info@mburoja.example" },
    { key: "privacy", icon: Lock, email: "privacy@mburoja.example" },
    { key: "press", icon: Megaphone, email: "press@mburoja.example" },
    { key: "security", icon: ShieldAlert, email: "security@mburoja.example" },
  ] as const;
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 md:px-8">
      <PageHeader title={t("contactTitle")} description={t("contactBody")} actions={<Button asChild><Link href="/report">{tr("report")}</Link></Button>} />
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map(({ key, icon: Icon, email }) => (
          <li key={key} className="glass-card space-y-2 rounded-xl p-5">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-medium">{t(`contactItems.${key}`)}</h2>
            <a href={`mailto:${email}`} className="font-mono text-sm text-primary underline underline-offset-2">{email}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
