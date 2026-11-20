"use client";

import { Bell, ChevronDown, ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { NavGroup, NavIcon as NavIconName } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSocBadge } from "@/components/soc/realtime-provider";
import { SidebarMenuBadge, SidebarSeparator } from "@/components/ui/sidebar";
import { signOut } from "@/server/auth-actions";
import { LanguageSwitch } from "./language-switch";
import { NavIcon } from "./nav-icon";
import { ThemeToggle } from "./theme-toggle";

export interface ShellItem {
  href: string;
  label: string;
  icon: NavIconName;
  group?: NavGroup;
  mobile?: boolean;
  /** Static count shown as a badge (e.g. unread alerts). */
  count?: number;
  /** Live badge from the SOC realtime provider. */
  liveBadge?: "inbox";
}

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Consecutive items with the same group become one sidebar section. */
function groupItems(items: ShellItem[]) {
  const out: { group?: NavGroup; items: ShellItem[] }[] = [];
  for (const item of items) {
    const last = out.at(-1);
    if (last && last.group === item.group) last.items.push(item);
    else out.push({ group: item.group, items: [item] });
  }
  return out;
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
  const settingsHref = items.find((i) => i.icon === "settings")?.href;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="gap-3 p-3">
          <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <Logo label={t("appName")} className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
          </Link>
          <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 group-data-[collapsible=icon]:hidden">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <NavIcon name={items[0]?.icon ?? "layout"} className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{areaTitle}</p>
              {(orgName ?? user.roleLabel) && <p className="truncate text-xs text-muted-foreground">{orgName ?? user.roleLabel}</p>}
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator className="mx-0 group-data-[collapsible=icon]:hidden" />
        <SidebarContent className="gap-0 py-1">
          {groupItems(items).map(({ group, items: groupList }, gi) => {
            const label = group ? t(`navGroups.${group}`) : areaTitle;
            const groupActive = groupList.some((i) => i.href === active);
            return (
              <Collapsible key={group ?? gi} defaultOpen className="group/collapsible">
                <SidebarGroup className="py-1.5">
                  <SidebarGroupLabel asChild className="h-7 text-[11px] font-semibold group-data-[collapsible=icon]:hidden tracking-wide text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
                    <CollapsibleTrigger className="w-full">
                      <span className={cn(groupActive && "text-sidebar-foreground")}>{label}</span>
                      <ChevronDown className="ml-auto size-3.5 transition-transform group-data-[state=closed]/collapsible:-rotate-90" aria-hidden="true" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent forceMount className="data-[state=closed]:hidden group-data-[collapsible=icon]:!block">
                    <SidebarGroupContent className="pt-0.5">
                      <SidebarMenu className="gap-0.5">
                        {groupList.map((item) => {
                          const isActive = active === item.href;
                          const badge = item.liveBadge === "inbox" ? live.inbox + (item.count ?? 0) : item.count ?? 0;
                          return (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={item.label}
                                className="h-9 data-[active=true]:bg-primary/12 data-[active=true]:font-medium data-[active=true]:text-primary"
                              >
                                <Link href={item.href} aria-current={isActive ? "page" : undefined}>
                                  <NavIcon name={item.icon} />
                                  <span>{item.label}</span>
                                </Link>
                              </SidebarMenuButton>
                              {badge > 0 && (
                                <SidebarMenuBadge className="rounded-full bg-flag-red/15 px-1.5 text-flag-red" aria-label={String(badge)}>
                                  {badge}
                                </SidebarMenuBadge>
                              )}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </SidebarContent>
        <SidebarSeparator className="mx-0" />
        <SidebarFooter className="p-2">
          <form id="shell-signout" action={signOut} className="hidden" />
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip={user.name} aria-label={t("accountMenu")} className="data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:p-0!">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">
                      {initials(user.name)}
                    </span>
                    <span className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.roleLabel}</span>
                    </span>
                    <ChevronsUpDown className="ml-auto size-4 opacity-60" aria-hidden="true" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.roleLabel}</p>
                  </DropdownMenuLabel>
                  {settingsHref && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={settingsHref}><Settings aria-hidden="true" />{t("settings")}</Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild variant="destructive">
                    <button type="submit" form="shell-signout" className="w-full">
                      <LogOut aria-hidden="true" />
                      {t("signOut")}
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
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
