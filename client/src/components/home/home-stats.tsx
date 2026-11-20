import { Activity, Globe, ScanSearch, Siren } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { CountUp } from "@/components/shared/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicStats } from "@/server/queries/public";

export async function HomeStats() {
  const [s, t, locale] = await Promise.all([getPublicStats(), getTranslations("home.stats"), getLocale()]);
  const items = [
    { icon: Siren, value: s.reportsToday, label: t("reportsToday") },
    { icon: Activity, value: s.activeCampaigns, label: t("activeCampaigns") },
    { icon: Globe, value: s.domainsBlocked, label: t("domainsBlocked") },
    { icon: ScanSearch, value: s.checksTotal, label: t("checks") },
  ];
  return (
    <div>
      <p className="sr-only">{t("srSummary", { reports: s.reportsToday, campaigns: s.activeCampaigns, domains: s.domainsBlocked })}</p>
      <dl className="grid grid-cols-2 gap-y-6 md:grid-cols-4 md:divide-x md:divide-border" aria-hidden="true">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4 md:px-8 md:first:pl-0">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-[1.15rem]" /></span>
            <div className="flex flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-display text-3xl font-bold tabular-nums"><CountUp value={value} locale={locale} /></dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function HomeStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-y-6 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 md:px-8 md:first:pl-0">
          <Skeleton className="size-5" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
