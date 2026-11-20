import { getTranslations } from "next-intl/server";
import { CampaignCard } from "@/components/shared/campaign-card";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getLatestPublicCampaigns } from "@/server/queries/public";

export async function LatestCampaigns() {
  const [items, t] = await Promise.all([getLatestPublicCampaigns(3), getTranslations("home.latest")]);
  if (!items.length) return <EmptyState title={t("empty")} />;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((c) => (
        <CampaignCard key={c.code} c={c} href={`/threats/${encodeURIComponent(c.code)}`} />
      ))}
    </div>
  );
}

export function LatestCampaignsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-52 rounded-xl" />
      ))}
    </div>
  );
}
