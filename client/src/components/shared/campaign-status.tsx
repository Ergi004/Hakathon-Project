import { CircleCheck, Eye, Gavel, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

type Status = Enums<"campaign_status">;

/** Colour, icon and word for each campaign status (colour is never the only signal). */
export const STATUS_STYLE: Record<Status, { icon: typeof Eye; className: string }> = {
  monitoring: { icon: Eye, className: "border-flag-grey/40 bg-flag-grey/12 text-foreground [&>svg]:text-flag-grey" },
  confirmed: { icon: ShieldAlert, className: "border-flag-red/40 bg-flag-red/12 text-foreground [&>svg]:text-flag-red" },
  takedown_in_progress: { icon: Gavel, className: "border-flag-orange/45 bg-flag-orange/14 text-foreground [&>svg]:text-flag-orange" },
  resolved: { icon: CircleCheck, className: "border-flag-green/40 bg-flag-green/12 text-foreground [&>svg]:text-flag-green" },
};

export function CampaignStatusBadge({ status, className }: { status: Status; className?: string }) {
  const t = useTranslations("campaignStatus");
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", s.className, className)}>
      <Icon aria-hidden="true" />
      {t(status)}
    </Badge>
  );
}
