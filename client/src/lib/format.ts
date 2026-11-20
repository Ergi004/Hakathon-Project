import { format, formatDistanceToNowStrict } from "date-fns";
import { enGB, sq } from "date-fns/locale";

const LOCALES = { sq, en: enGB } as const;
type L = keyof typeof LOCALES;

export function fmtDate(value: string | Date | null | undefined, locale: string, pattern = "d MMM yyyy"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, pattern, { locale: LOCALES[(locale as L) in LOCALES ? (locale as L) : "sq"] });
}

export function fmtDateTime(value: string | Date | null | undefined, locale: string): string {
  return fmtDate(value, locale, "d MMM yyyy, HH:mm");
}

export function fmtAgo(value: string | Date | null | undefined, locale: string): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: LOCALES[(locale as L) in LOCALES ? (locale as L) : "sq"] });
}

export function fmtNumber(n: number | null | undefined, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sq-AL").format(n ?? 0);
}
