import { ArrowRight, CalendarDays, Globe, MessageSquare, Target } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { defangValue } from "@/lib/defang";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";
import { CampaignStatusBadge } from "./campaign-status";
import { SeverityDot } from "./severity-dot";

/** Severity stripe colour (always paired with the SeverityDot word, never colour alone). */
const SEVERITY_STRIPE = {
  low: "bg-flag-green",
  medium: "bg-flag-yellow",
  high: "bg-flag-orange",
  critical: "bg-flag-red",
} as const;

export interface CampaignCardData {
  code: string;
  tactic: string;
  imitated_name: string | null;
  first_seen: string | null;
  last_seen: string | null;
  message_count: number | null;
  status: Enums<"campaign_status"> | null;
  domains?: string[] | null;
  severity?: Enums<"severity"> | null;
}

/** Campaign ID, institution, tactic, dates, counts, status (SPEC 3). */
export function CampaignCard({ c, href }: { c: CampaignCardData; href?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const domains = c.domains ?? [];
  const active = c.status !== "resolved";

  return (
    <Card className={cn("group/campaign relative h-full gap-0 py-0 transition-shadow", href && "hover:ring-primary/40 focus-within:ring-2 focus-within:ring-ring")}>
      {/* Left edge: severity colour when known (SOC views), otherwise marks campaigns that are still live. */}
      {c.severity ? (
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", SEVERITY_STRIPE[c.severity])} />
      ) : (
        active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-flag-red/70" />
      )}
      <CardHeader className="pt-5 pb-4">
        <CardDescription className="font-mono text-xs">{c.code}</CardDescription>
        <CardTitle className="font-display text-lg leading-snug">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {c.imitated_name ?? t("ui.unknown")}
            </Link>
          ) : (
            (c.imitated_name ?? t("ui.unknown"))
          )}
        </CardTitle>
        {(c.status || c.severity) && (
          <CardAction className="flex flex-col items-end gap-1.5">
            {c.status && <CampaignStatusBadge status={c.status} />}
            {c.severity && <SeverityDot severity={c.severity} className="font-medium" />}
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-4">
        <dl className="grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Target className="size-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">{t("campaignCard.tactic")}</dt>
            <dd className="truncate capitalize">{c.tactic.replace(/_/g, " ")}</dd>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <dd>
              {t("campaignCard.since", { date: fmtDate(c.first_seen, locale) })}
              {c.last_seen && ` ${t("campaignCard.until", { date: fmtDate(c.last_seen, locale) })}`}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
            <dd>{t("campaignCard.messages", { count: c.message_count ?? 0 })}</dd>
          </div>
        </dl>

        {domains.length > 0 && (
          <div className="rounded-lg bg-muted/60 p-2.5">
            <ul className="space-y-1">
              {domains.slice(0, 2).map((d) => (
                <li key={d} className="flex items-center gap-2 font-mono text-xs">
                  <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{defangValue(d.replace(/\[\.\]/g, "."))}</span>
                </li>
              ))}
            </ul>
            {domains.length > 2 && <p className="mt-1 pl-5.5 text-xs text-muted-foreground">{t("campaignCard.domains", { count: domains.length })}</p>}
          </div>
        )}
      </CardContent>

      {href && (
        <>
          <Separator />
          <CardFooter className="justify-between py-3 text-sm font-medium text-primary">
            {t("campaignCard.open")}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover/campaign:translate-x-0.5" aria-hidden="true" />
          </CardFooter>
        </>
      )}
    </Card>
  );
}
