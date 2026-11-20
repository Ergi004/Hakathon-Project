import { getLocale, getTranslations } from "next-intl/server";
import { fmtDate } from "@/lib/format";
import { asBrandCategory, asScamType } from "@/lib/pattern-labels";
import { getPublicStats, type RegionKind } from "@/server/queries/public";

function regionKindLabel(kind: RegionKind, hosting: string, place: string): string {
  switch (kind) {
    case "hosting_country":
      return hosting;
    case "claimed_place":
      return place;
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function CountList({ title, rows }: { title: string; rows: { key: string; label: string; count: number }[] }) {
  if (!rows.length) return null;
  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="tabular-nums text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Aggregate counts only. Regions below the minimum are already omitted by the query. */
export async function CheckAggregates() {
  const [stats, t, tScam, tBrand, locale] = await Promise.all([
    getPublicStats(),
    getTranslations("aggregates"),
    getTranslations("scamType"),
    getTranslations("brandCategory"),
    getLocale(),
  ]);
  if (!stats.byScamType.length && !stats.byBrand.length && !stats.byWeek.length && !stats.regions.length) return null;
  const hosting = t("hostingCountry");
  const place = t("claimedPlace");
  return (
    <section className="space-y-3" aria-labelledby="check-aggregates-title">
      <div>
        <h2 id="check-aggregates-title" className="font-medium">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("note")}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CountList
          title={t("scamType")}
          rows={stats.byScamType.map((row) => {
            const key = asScamType(row.scamType);
            return { key: row.scamType, label: key ? tScam(key) : row.scamType, count: row.count };
          })}
        />
        <CountList
          title={t("brand")}
          rows={stats.byBrand.map((row) => {
            const key = asBrandCategory(row.brand);
            return { key: row.brand, label: key ? tBrand(key) : row.brand, count: row.count };
          })}
        />
        <CountList
          title={t("week")}
          rows={stats.byWeek.map((row) => ({ key: row.week, label: fmtDate(row.week, locale), count: row.count }))}
        />
        <CountList
          title={t("regions")}
          rows={stats.regions.map((row) => ({
            key: `${row.kind}:${row.name}`,
            label: t("regionItem", { kind: regionKindLabel(row.kind, hosting, place), name: row.name }),
            count: row.count,
          }))}
        />
      </div>
    </section>
  );
}
