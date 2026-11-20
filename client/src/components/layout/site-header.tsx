"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { PUBLIC_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { LanguageSwitch } from "./language-switch";
import { ThemeToggle } from "./theme-toggle";

/** Sticky public top bar (SPEC 3 "Public site"). */
export function SiteHeader() {
  const t = useTranslations("public.nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-8">
        <Link href="/" className="shrink-0 rounded-md" aria-label={tc("appName")}>
          <Logo label={tc("appName")} />
        </Link>

        <nav aria-label={tc("menu")} className="hidden flex-1 items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive(item.href) ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitch />
          <ThemeToggle />
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/login">{tc("signIn")}</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={tc("menu")}>
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>{tc("menu")}</SheetTitle>
              </SheetHeader>
              <nav aria-label={tc("menu")} className="flex flex-col gap-1 px-4">
                {PUBLIC_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className="rounded-md px-3 py-3 text-base hover:bg-accent"
                  >
                    {t(item.key)}
                  </Link>
                ))}
                <Link href="/login" className="rounded-md px-3 py-3 text-base hover:bg-accent">
                  {tc("signIn")}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
