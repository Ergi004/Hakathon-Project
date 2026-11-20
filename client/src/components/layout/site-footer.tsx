import { Fingerprint, LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { WIDE } from "@/components/home/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { PUBLIC_FOOTER_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SiteFooter() {
  const t = useTranslations("public");
  const tc = useTranslations("common");
  const th = useTranslations("home.final");

  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      {/* Help for people who already fell for a scam */}
      <div className="border-b border-border">
        <div className={cn(WIDE, "flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between")}>
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-flag-orange/15 text-flag-orange">
              <LifeBuoy className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-medium">{t("footer.helpTitle")}</h2>
              <p className="max-w-[62ch] text-muted-foreground">{t("footer.helpBody")}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Button asChild className="rounded-full">
              <Link href="/report">{th("report")}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/track">{t("nav.track")}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Brand and link groups */}
      <div className={cn(WIDE, "grid gap-10 py-14 lg:grid-cols-12")}>
        <div className="space-y-4 lg:col-span-4">
          <Link href="/" className="inline-block rounded-md" aria-label={tc("appName")}>
            <Logo label={tc("appName")} />
          </Link>
          <p className="max-w-xs text-muted-foreground">{tc("tagline")}</p>
          <p className="flex max-w-xs gap-2 text-sm text-muted-foreground">
            <Fingerprint className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t("footer.promise")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:justify-items-end">
          {PUBLIC_FOOTER_GROUPS.map((group) => (
            <nav key={group.key} aria-labelledby={`footer-${group.key}`} className="min-w-40">
              <h2 id={`footer-${group.key}`} className="mb-4 text-sm font-medium">{t(`footer.groups.${group.key}`)}</h2>
              <ul className="space-y-2.5 text-sm">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
                      {t(`nav.${item.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* Bottom line */}
      <div className="border-t border-border">
        <p className={cn(WIDE, "py-6 text-xs text-muted-foreground")}>{t("footer.rights")}</p>
      </div>
    </footer>
  );
}
