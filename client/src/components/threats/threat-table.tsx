import { useLocale, useTranslations } from "next-intl";
import { CampaignStatusBadge } from "@/components/shared/campaign-status";
import type { CampaignCardData } from "@/components/shared/campaign-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { defangValue } from "@/lib/defang";
import { fmtDate } from "@/lib/format";

/** Dense list view of the public feed. Rows link to the campaign page. */
export function ThreatTable({ items }: { items: CampaignCardData[] }) {
  const t = useTranslations("threats.cols");
  const tu = useTranslations("ui");
  const locale = useLocale();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="pl-4">{t("institution")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("tactic")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("domains")}</TableHead>
            <TableHead className="text-right">{t("messages")}</TableHead>
            <TableHead className="hidden pr-4 text-right sm:table-cell">{t("lastSeen")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((c) => {
            const d = c.domains?.[0];
            return (
              <TableRow key={c.code} className="relative">
                <TableCell className="pl-4">
                  <Link href={`/threats/${encodeURIComponent(c.code)}`} className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-none">
                    {c.imitated_name ?? tu("unknown")}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">{c.code}</p>
                </TableCell>
                <TableCell>{c.status && <CampaignStatusBadge status={c.status} />}</TableCell>
                <TableCell className="hidden capitalize md:table-cell">{c.tactic.replace(/_/g, " ")}</TableCell>
                <TableCell className="hidden max-w-56 truncate font-mono text-xs lg:table-cell">
                  {d ? defangValue(d.replace(/\[\.\]/g, ".")) : "–"}
                  {(c.domains?.length ?? 0) > 1 && <span className="ml-1 text-muted-foreground">+{c.domains!.length - 1}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.message_count ?? 0}</TableCell>
                <TableCell className="hidden pr-4 text-right text-muted-foreground sm:table-cell">{fmtDate(c.last_seen, locale)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
