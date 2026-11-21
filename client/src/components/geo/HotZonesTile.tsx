import { ArrowRight, MapPinned } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth";
import { getTopHotZones } from "@/server/geo/stats";
import { RegionMiniMap } from "./RegionMiniMap";
import { SeverityChip } from "./SeverityChip";

/** Command centre: compact map with the top 3 hot zones, linking to /soc/geo. */
export async function HotZonesTile() {
  const ctx = await requireRole("soc_analyst");
  const [t, locale] = await Promise.all([getTranslations("geo"), getLocale()]);
  const { zones, ready } = await getTopHotZones(ctx.supabase, locale, 3);
  const counts = Object.fromEntries(zones.flatMap((z) => z.members.map((m) => [m, Math.max(3, Math.round(z.observed / z.members.length))])));
  return (
    <section className="glass-card space-y-3 rounded-xl p-4" aria-labelledby="hz-tile">
      <div className="flex items-center justify-between gap-2">
        <h2 id="hz-tile" className="inline-flex items-center gap-2 font-medium"><MapPinned className="size-4" aria-hidden="true" />{t("tile.title")}</h2>
        <Link href="/soc/geo" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{t("tile.open")}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <RegionMiniMap label={t("tile.title")} counts={counts} />
        {!ready ? <p className="text-sm text-muted-foreground">{t("setup.short")}</p> : zones.length === 0 ? <p className="text-sm text-muted-foreground">{t("hot.empty")}</p> : (
          <ol className="space-y-2">
            {zones.map((z) => (
              <li key={z.code}>
                <Link href={`/soc/geo/${z.code}`} className="block rounded-lg border border-border p-2 hover:bg-muted/50">
                  <span className="flex flex-wrap items-center justify-between gap-1"><span className="text-sm font-medium">{z.members.length > 1 ? t("hot.zoneName", { name: z.name }) : z.name}</span><SeverityChip severity={z.severity} /></span>
                  <span className="text-xs text-muted-foreground">{t("tile.line", { observed: z.observed, expected: z.expected.toFixed(1) })}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
