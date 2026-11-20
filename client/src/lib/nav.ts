/** Navigation per area (SPEC 7-10). Labels come from messages/<locale>.json. */

export type NavIcon =
  | "home" | "list" | "file" | "bell" | "eye" | "book" | "users" | "puzzle" | "lock" | "settings"
  | "layout" | "wand" | "alert" | "flag" | "globe" | "megaphone" | "graduation" | "key" | "download"
  | "gauge" | "inbox" | "gavel" | "chart" | "search" | "ban" | "target" | "siren" | "shield" | "map";

export interface NavEntry<K extends string = string> {
  key: K;
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

export const PUBLIC_FOOTER_NAV = [
  { key: "track", href: "/track" },
  { key: "apiDocs", href: "/api-docs" },
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "accessibility", href: "/accessibility" },
  { key: "contact", href: "/contact" },
] as const;

export const CITIZEN_NAV = [
  { key: "home", href: "/citizen", icon: "home", mobile: true },
  { key: "checks", href: "/citizen/checks", icon: "list", mobile: true },
  { key: "reports", href: "/citizen/reports", icon: "file", mobile: true },
  { key: "alerts", href: "/citizen/alerts", icon: "bell", mobile: true },
  { key: "watchlist", href: "/citizen/watchlist", icon: "eye" },
  { key: "learn", href: "/citizen/learn", icon: "book" },
  { key: "extension", href: "/citizen/extension", icon: "puzzle" },
  { key: "privacy", href: "/citizen/privacy", icon: "lock" },
  { key: "settings", href: "/citizen/settings", icon: "settings" },
] as const satisfies readonly NavEntry[];

export const BUSINESS_NAV = [
  { key: "overview", href: "/business", icon: "layout" },
  { key: "onboarding", href: "/business/onboarding", icon: "wand" },
  { key: "alerts", href: "/business/alerts", icon: "alert" },
  { key: "campaigns", href: "/business/campaigns", icon: "flag" },
  { key: "domains", href: "/business/domains", icon: "globe" },
  { key: "reports", href: "/business/reports", icon: "file" },
  { key: "notices", href: "/business/notices", icon: "megaphone" },
  { key: "training", href: "/business/training", icon: "graduation" },
  { key: "api", href: "/business/api", icon: "key" },
  { key: "team", href: "/business/team", icon: "users" },
  { key: "export", href: "/business/reports/export", icon: "download" },
  { key: "settings", href: "/business/settings", icon: "settings" },
] as const satisfies readonly NavEntry[];

export const SOC_NAV = [
  { key: "command", href: "/soc", icon: "gauge" },
  { key: "inbox", href: "/soc/inbox", icon: "inbox" },
  { key: "campaigns", href: "/soc/campaigns", icon: "flag" },
  { key: "domains", href: "/soc/domains", icon: "globe" },
  { key: "takedowns", href: "/soc/takedowns", icon: "gavel" },
  { key: "geo", href: "/soc/geo", icon: "map" },
  { key: "threatMap", href: "/soc/threat-map", icon: "chart" },
  { key: "search", href: "/soc/search", icon: "search" },
  { key: "advisories", href: "/soc/advisories", icon: "megaphone" },
  { key: "blocklist", href: "/soc/blocklist", icon: "ban" },
  { key: "quality", href: "/soc/quality", icon: "target" },
  { key: "alerts", href: "/soc/alerts", icon: "siren" },
  { key: "admin", href: "/soc/admin", icon: "shield" },
] as const satisfies readonly NavEntry[];

export const ADMIN_NAV = [
  { key: "overview", href: "/admin", icon: "layout" },
  { key: "organizations", href: "/admin/organizations", icon: "users" },
  { key: "admin", href: "/soc/admin", icon: "shield" },
] as const satisfies readonly NavEntry[];
