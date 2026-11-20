import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

function AuthHeader() {
  const t = useTranslations("common");
  return (
    <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-8">
      <Link href="/" className="rounded-md">
        <Logo label={t("appName")} />
      </Link>
      <div className="flex items-center gap-1">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return (
    <div className="relative flex flex-1 flex-col">
      <div aria-hidden="true" className="bg-hero-glow pointer-events-none absolute inset-0" />
      <AuthHeader />
      <main id="main" className="relative flex flex-1 items-start justify-center px-4 py-10 md:items-center">
        {children}
      </main>
    </div>
  );
}
