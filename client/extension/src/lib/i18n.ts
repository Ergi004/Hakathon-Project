/** chrome.i18n wrapper; falls back to the key so missing strings are visible in development. */
export function t(key: string, sub?: string | string[]): string {
  try {
    return chrome.i18n.getMessage(key, sub) || key;
  } catch {
    return key;
  }
}

export function uiLocale(): "sq" | "en" {
  try {
    return chrome.i18n.getUILanguage().toLowerCase().startsWith("sq") ? "sq" : "en";
  } catch {
    return "sq";
  }
}

export const FLAG_COLOR: Record<string, string> = {
  green: "#16a34a", yellow: "#ca8a04", orange: "#ea580c", red: "#dc2626", darkred: "#7f1d1d", grey: "#6b7280",
};
export const FLAG_ICON: Record<string, string> = { green: "✓", yellow: "!", orange: "⚠", red: "⚠", darkred: "⛔", grey: "?" };
