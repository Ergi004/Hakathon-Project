import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { PUBLIC_FOOTER_NAV } from "@/lib/nav";

export function SiteFooter() {
  const t = useTranslations("public");
  const tc = useTranslations("common");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="space-y-2">
          <Logo label={tc("appName")} />
          <p className="max-w-xs text-sm text-muted-foreground">{tc("tagline")}</p>
          <p className="text-xs text-muted-foreground">{t("footer.rights")}</p>
        </div>
        <nav aria-label={t("footer.legal")}>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {PUBLIC_FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted-foreground hover:text-foreground">
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
