"use client";

import { Bell, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import type { NavIcon as NavIconName } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSocBadge } from "@/components/soc/realtime-provider";
import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { signOut } from "@/server/auth-actions";
import { LanguageSwitch } from "./language-switch";
import { NavIcon } from "./nav-icon";
import { ThemeToggle } from "./theme-toggle";

export interface ShellItem {
  href: string;
  label: string;
  icon: NavIconName;
  mobile?: boolean;
  /** Static count shown as a badge (e.g. unread alerts). */
  count?: number;
  /** Live badge from the SOC realtime provider. */
  liveBadge?: "inbox";
}

function useActiveHref(items: ShellItem[]) {
  const pathname = usePathname();
  let best: string | null = null;
  for (const { href } of items) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

/** Sidebar layout shared by the citizen, business, SOC and admin areas (SPEC 3). */
export function AppShell({
  areaTitle,
  items,
  user,
  orgName,
  orgSlot,
  bellHref,
  bottomNav = false,
  statusBar,
  dense = false,
  children,
}: {
  areaTitle: string;
  items: ShellItem[];
  user: { name: string; roleLabel: string };
  orgName?: string;
  /** Replaces the org name with a control (business org switcher). */
  orgSlot?: ReactNode;
  bellHref?: string;
  bottomNav?: boolean;
  statusBar?: ReactNode;
  dense?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  const active = useActiveHref(items);
  const live = useSocBadge();
  const mobileItems = items.filter((i) => i.mobile);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1.5 outline-none">
            <Logo label={t("appName")} className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{areaTitle}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active === item.href} tooltip={item.label}>
                      <Link href={item.href} aria-current={active === item.href ? "page" : undefined}>
                        <NavIcon name={item.icon} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {(item.liveBadge === "inbox" ? live.inbox + (item.count ?? 0) : item.count ?? 0) > 0 && (
                      <SidebarMenuBadge aria-label={String(item.liveBadge === "inbox" ? live.inbox + (item.count ?? 0) : item.count)}>
                        {item.liveBadge === "inbox" ? live.inbox + (item.count ?? 0) : item.count}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="min-w-0 px-2 py-1 text-xs group-data-[collapsible=icon]:hidden">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-muted-foreground">{user.roleLabel}</p>
          </div>
          <form action={signOut}>
            <SidebarMenuButton type="submit" tooltip={t("signOut")}>
              <LogOut aria-hidden="true" />
              <span>{t("signOut")}</span>
            </SidebarMenuButton>
          </form>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <SidebarTrigger aria-label={t("toggleSidebar")} />
          <div className="min-w-0 flex-1">
            {orgSlot ? (
              orgSlot
            ) : orgName ? (
              <p className="truncate text-sm">
                <span className="sr-only">{t("activeOrg")}: </span>
                <span className="font-medium">{orgName}</span>
              </p>
            ) : (
              <p className="truncate text-sm text-muted-foreground">{areaTitle}</p>
            )}
          </div>
          {bellHref && (
            <Button variant="ghost" size="icon" asChild>
              <Link href={bellHref} aria-label={t("notifications")}>
                <Bell className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
          <LanguageSwitch />
          <ThemeToggle />
        </header>

        <main
          id="main"
          className={cn(
            "flex-1 px-4 py-6 md:px-8",
            dense && "text-sm",
            bottomNav && "pb-24 md:pb-6",
            statusBar && "pb-12",
          )}
        >
          {children}
        </main>

        {statusBar && (
          <div className="sticky bottom-0 z-20 border-t border-border bg-background/90 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
            {statusBar}
          </div>
        )}

        {bottomNav && mobileItems.length > 0 && (
          <nav
            aria-label={areaTitle}
            className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
          >
            {mobileItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight",
                  active === item.href ? "text-primary" : "text-muted-foreground",
                )}
              >
                <NavIcon name={item.icon} className="size-5" />
                <span className="line-clamp-1 text-center">{item.label}</span>
              </Link>
            ))}
          </nav>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
