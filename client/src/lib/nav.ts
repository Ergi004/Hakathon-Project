/** Navigation per area (SPEC 7-10). Labels come from messages/<locale>.json. */

export type NavIcon =
  | "home" | "list" | "file" | "bell" | "eye" | "book" | "users" | "puzzle" | "lock" | "settings"
  | "layout" | "wand" | "alert" | "flag" | "globe" | "megaphone" | "graduation" | "key" | "download"
  | "gauge" | "inbox" | "gavel" | "chart" | "search" | "ban" | "target" | "siren" | "shield" | "map" | "radar";

export type NavGroup =
  | "activity" | "protection" | "account" | "monitor" | "respond" | "people" | "setup"
  | "operations" | "investigate" | "manage";

export interface NavEntry<K extends string = string> {
  key: K;
  /** Sidebar section; label in common.navGroups. */
  group: NavGroup;
  href: string;
  icon: NavIcon;
  /** Shown in the mobile bottom tab bar (citizen area only). */
  mobile?: boolean;
}

export const PUBLIC_NAV = [
  { key: "check", href: "/check" },
  { key: "report", href: "/report" },
  { key: "threats", href: "/threats" },
  { key: "learn", href: "/learn" },
  { key: "institutions", href: "/institutions" },
  { key: "extension", href: "/extension" },
] as const;

/** Footer link groups. Keys are labels in public.nav, group keys in public.footer.groups. */
export const PUBLIC_FOOTER_GROUPS = [
  {
    key: "tools",
    links: [
      { key: "check", href: "/check" },
      { key: "report", href: "/report" },
      { key: "track", href: "/track" },
      { key: "extension", href: "/extension" },
    ],
  },
  {
    key: "learn",
    links: [
      { key: "threats", href: "/threats" },
      { key: "learn", href: "/learn" },
      { key: "institutions", href: "/institutions" },
    ],
  },
  {
    key: "about",
    links: [
      { key: "contact", href: "/contact" },
      { key: "apiDocs", href: "/api-docs" },
      { key: "privacy", href: "/privacy" },
      { key: "terms", href: "/terms" },
      { key: "accessibility", href: "/accessibility" },
    ],
  },
] as const;

export const CITIZEN_NAV = [
  { key: "home", group: "activity", href: "/citizen", icon: "home", mobile: true },
  { key: "checks", group: "activity", href: "/citizen/checks", icon: "list", mobile: true },
  { key: "reports", group: "activity", href: "/citizen/reports", icon: "file", mobile: true },
  { key: "alerts", group: "activity", href: "/citizen/alerts", icon: "bell", mobile: true },
  { key: "watchlist", group: "protection", href: "/citizen/watchlist", icon: "eye" },
  { key: "learn", group: "protection", href: "/citizen/learn", icon: "book" },
  { key: "extension", group: "protection", href: "/citizen/extension", icon: "puzzle" },
  { key: "privacy", group: "account", href: "/citizen/privacy", icon: "lock" },
  { key: "settings", group: "account", href: "/citizen/settings", icon: "settings" },
] as const satisfies readonly NavEntry[];

export const BUSINESS_NAV = [
  { key: "overview", group: "monitor", href: "/business", icon: "layout" },
  { key: "alerts", group: "monitor", href: "/business/alerts", icon: "alert" },
  { key: "campaigns", group: "monitor", href: "/business/campaigns", icon: "flag" },
  { key: "domains", group: "monitor", href: "/business/domains", icon: "globe" },
  { key: "reports", group: "respond", href: "/business/reports", icon: "file" },
  { key: "notices", group: "respond", href: "/business/notices", icon: "megaphone" },
  { key: "export", group: "respond", href: "/business/reports/export", icon: "download" },
  { key: "training", group: "people", href: "/business/training", icon: "graduation" },
  { key: "team", group: "people", href: "/business/team", icon: "users" },
  { key: "onboarding", group: "setup", href: "/business/onboarding", icon: "wand" },
  { key: "api", group: "setup", href: "/business/api", icon: "key" },
  { key: "settings", group: "setup", href: "/business/settings", icon: "settings" },
] as const satisfies readonly NavEntry[];

export const SOC_NAV = [
  { key: "command", group: "operations", href: "/soc", icon: "gauge" },
  { key: "inbox", group: "operations", href: "/soc/inbox", icon: "inbox" },
  { key: "alerts", group: "operations", href: "/soc/alerts", icon: "siren" },
  { key: "intel", group: "investigate", href: "/soc/intel", icon: "radar" },
  { key: "campaigns", group: "investigate", href: "/soc/campaigns", icon: "flag" },
  { key: "domains", group: "investigate", href: "/soc/domains", icon: "globe" },
  { key: "geo", group: "investigate", href: "/soc/geo", icon: "map" },
  { key: "threatMap", group: "investigate", href: "/soc/threat-map", icon: "chart" },
  { key: "search", group: "investigate", href: "/soc/search", icon: "search" },
  { key: "takedowns", group: "respond", href: "/soc/takedowns", icon: "gavel" },
  { key: "advisories", group: "respond", href: "/soc/advisories", icon: "megaphone" },
  { key: "blocklist", group: "respond", href: "/soc/blocklist", icon: "ban" },
  { key: "quality", group: "manage", href: "/soc/quality", icon: "target" },
  { key: "admin", group: "manage", href: "/soc/admin", icon: "shield" },
] as const satisfies readonly NavEntry[];

export const ADMIN_NAV = [
  { key: "overview", group: "manage", href: "/admin", icon: "layout" },
  { key: "organizations", group: "manage", href: "/admin/organizations", icon: "users" },
  { key: "admin", group: "manage", href: "/soc/admin", icon: "shield" },
] as const satisfies readonly NavEntry[];
