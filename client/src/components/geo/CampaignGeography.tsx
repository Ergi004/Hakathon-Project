import { MapPinned } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { regionName } from "@/lib/geo/regions";
import { requireRole } from "@/server/auth";
import { getCampaignGeography } from "@/server/geo/stats";
import { RegionMiniMap } from "./RegionMiniMap";

/** Campaign workspace "Geography" tab (victim locations, last 30 days) + imitated authority marker. */
export async function CampaignGeography({ campaign }: { campaign: { id: string; code: string; target_region_id?: string | null; institution_id?: string | null } }) {
  const ctx = await requireRole("soc_analyst");
  const [t, locale] = await Promise.all([getTranslations("geo"), getLocale()]);
  const g = await getCampaignGeography(ctx.supabase, campaign);
  if (!g) return <p className="text-sm text-muted-foreground">{t("setup.short")}</p>;
  const top = Object.entries(g.counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="grid gap-5 md:grid-cols-[260px_1fr]">
      <RegionMiniMap label={t("campaign.mapLabel", { code: campaign.code })} counts={g.counts} markers={g.imitatedCode ? [g.imitatedCode] : []} />
      <div className="space-y-4 text-sm">
        <p>{t("campaign.summary", { total: g.total, unknown: g.unknown })}</p>
        {g.imitatedCode ? (
          <p className="inline-flex items-center gap-2"><MapPinned className="size-4 text-primary" aria-hidden="true" />{t("campaign.imitated", { name: regionName(g.imitatedCode, locale) })}</p>
        ) : <p className="text-muted-foreground">{t("campaign.national")}</p>}
        {top.length > 0 && (
          <ol className="space-y-1">
            {top.map(([code, n]) => (
              <li key={code} className="flex justify-between gap-3 border-b border-border/60 py-1">
                <Link href={`/soc/geo/${code}?campaign=${encodeURIComponent(campaign.code)}`} className="text-primary hover:underline">{regionName(code, locale)}</Link>
                <span className="font-mono">{n < 3 ? t("table.lowData") : n}</span>
              </li>
            ))}
          </ol>
        )}
        <Link href={`/soc/geo?campaign=${encodeURIComponent(campaign.code)}&range=30d`} className="inline-block text-primary hover:underline">{t("campaign.openMap")}</Link>
      </div>
    </div>
  );
}
