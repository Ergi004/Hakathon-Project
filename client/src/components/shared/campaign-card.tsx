import { CalendarDays, Globe, MessageSquare, Target } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { fmtDate } from "@/lib/format";
import type { Enums } from "@/types/database";
import { defangValue } from "./defanged-text";

export interface CampaignCardData {
  code: string;
  tactic: string;
  imitated_name: string | null;
  first_seen: string | null;
  last_seen: string | null;
  message_count: number | null;
  status: Enums<"campaign_status"> | null;
  domains?: string[] | null;
}

/** Campaign ID, institution, tactic, dates, counts, status (SPEC 3). */
export function CampaignCard({ c, href }: { c: CampaignCardData; href?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const domains = c.domains ?? [];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
          <h3 className="truncate font-display text-lg font-medium">{c.imitated_name ?? t("ui.unknown")}</h3>
        </div>
        {c.status && <Badge variant={c.status === "resolved" ? "secondary" : "outline"}>{t(`campaignStatus.${c.status}`)}</Badge>}
      </div>
      <dl className="grid grid-cols-1 gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Target className="size-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">{t("campaignCard.tactic")}</dt>
          <dd className="truncate">{c.tactic.replace(/_/g, " ")}</dd>
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
        {domains.length > 0 && (
          <div className="flex items-start gap-2">
            <Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <dd className="min-w-0 space-y-0.5">
              {domains.slice(0, 3).map((d) => (
                <p key={d} className="truncate font-mono text-xs">{defangValue(d.replace(/\[\.\]/g, "."))}</p>
              ))}
              {domains.length > 3 && <p className="text-xs">{t("campaignCard.domains", { count: domains.length })}</p>}
            </dd>
          </div>
        )}
      </dl>
    </>
  );
  const cls = "glass-card flex h-full flex-col gap-3 rounded-xl p-4 transition-transform duration-200 ease-out";
  return href ? (
    <Link href={href} className={`${cls} hover:-translate-y-0.5 focus-visible:-translate-y-0.5`} aria-label={`${c.code} ${c.imitated_name ?? ""}`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
