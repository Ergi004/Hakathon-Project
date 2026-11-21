"use client";

import { HelpCircle, MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { HotItem } from "@/server/geo/stats";
import { SeverityChip } from "./SeverityChip";

export function HotZoneList({ hot, onFocus, source, computedAt, unknown, total, mode }: {
  hot: HotItem[];
  onFocus: (code: string) => void;
  source: "precomputed" | "live";
  computedAt: string | null;
  unknown: { count: number; share: number };
  total: number;
  mode: "victim" | "imitated";
}) {
  const t = useTranslations("geo.hot");
  return (
    <div className="space-y-4">
      <section className="glass-card space-y-3 rounded-xl p-4" aria-labelledby="hz-title">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="hz-title" className="font-medium">{t("title")}</h2>
          <span className="text-xs text-muted-foreground">{source === "precomputed" && computedAt ? t("computedAt", { time: new Date(computedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }) : t("live")}</span>
        </div>
        {hot.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ol className="space-y-2">
            {hot.map((z, i) => (
              <li key={z.code}>
                <button type="button" onClick={() => onFocus(z.code)} className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium"><span className="mr-1 font-mono text-xs text-muted-foreground">{i + 1}.</span>{z.members.length > 1 ? t("zoneName", { name: z.name }) : z.name}</span>
                    <SeverityChip severity={z.severity} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">{t("observedExpected")}</dt>
                    <dd className="text-right font-mono">{z.observed} / {z.expected.toFixed(1)}</dd>
                    <dt className="text-muted-foreground">{t("spike")}</dt>
                    <dd className="text-right font-mono">{z.spike === null ? t("newActivity") : `${z.spike.toFixed(1)}×`}</dd>
                    {z.members.length > 1 && (<><dt className="text-muted-foreground">{t("members")}</dt><dd className="text-right">{z.members.length}</dd></>)}
                    {z.topInstitution && (<><dt className="text-muted-foreground">{t("topInstitution")}</dt><dd className="truncate text-right">{z.topInstitution.name}</dd></>)}
                  </dl>
                </button>
                {z.topCampaign?.code && (
                  <Link href={`/soc/campaigns/${z.topCampaign.id}`} className="mt-1 inline-block px-1 text-xs text-primary hover:underline">{t("topCampaign", { code: z.topCampaign.code })}</Link>
                )}
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">{t("suppressed")}</p>
      </section>

      <section className="glass-card space-y-1 rounded-xl p-4" aria-labelledby="unk-title">
        <h2 id="unk-title" className="inline-flex items-center gap-2 font-medium">
          {mode === "victim" ? <MapPinOff className="size-4" aria-hidden="true" /> : <HelpCircle className="size-4" aria-hidden="true" />}
          {mode === "victim" ? t("unknownTitle") : t("nationalTitle")}
        </h2>
        <p className="font-display text-2xl">{unknown.count}<span className="ml-2 text-sm text-muted-foreground">{t("share", { pct: Math.round(unknown.share * 100), total })}</span></p>
        <p className="text-xs text-muted-foreground">{mode === "victim" ? t("unknownHint") : t("nationalHint")}</p>
      </section>
    </div>
  );
}
