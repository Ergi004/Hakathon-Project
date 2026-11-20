import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <LogoMark className="size-16" animated />
      <h1 className="font-display text-3xl font-bold">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-muted-foreground">{t("notFoundBody")}</p>
      <Button asChild>
        <Link href="/check">{t("backToChecker")}</Link>
      </Button>
    </main>
  );
}
