"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadText, toCsv } from "@/lib/csv";
import { CopyButton } from "./copy-button";
import { defangValue } from "@/lib/defang";
import { DefangedText } from "./defanged-text";

export interface IocRow {
  type: string;
  value: string;
  campaign?: string | null;
  first_seen?: string | null;
}

/** Domains, URLs, IPs, certificates with copy all and CSV/JSON export (SPEC 3). */
export function IocTable({ rows, filename = "iocs", onReveal }: { rows: IocRow[]; filename?: string; onReveal?: (row: IocRow) => void }) {
  const t = useTranslations();
  const defanged = rows.map((r) => ({ ...r, value: defangValue(r.value.replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http")) }));
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t("ui.empty")}</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <CopyButton size="sm" value={defanged.map((r) => r.value).join("\n")} label={t("ui.copyAll")} />
        <Button type="button" variant="outline" size="sm" onClick={() => downloadText(`${filename}.csv`, toCsv(defanged, ["type", "value", "campaign", "first_seen"]))}>
          <Download className="size-3.5" aria-hidden="true" /> {t("ui.exportCsv")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadText(`${filename}.json`, JSON.stringify(defanged, null, 2), "application/json")}>
          <Download className="size-3.5" aria-hidden="true" /> {t("ui.exportJson")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ioc.type")}</TableHead>
              <TableHead>{t("ioc.value")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("ioc.campaign")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.type}:${r.value}:${i}`}>
                <TableCell className="text-xs whitespace-nowrap">{t(`ioc.types.${r.type as "domain"}`)}</TableCell>
                {/* w-full + max-w-0: the value column takes the remaining width and truncates instead of
                    stretching the table (max-width alone is ignored on cells of an auto-layout table). */}
                <TableCell className="w-full max-w-0">
                  <DefangedText value={r.value} onReveal={onReveal ? () => onReveal(r) : undefined} />
                </TableCell>
                <TableCell className="hidden font-mono text-xs whitespace-nowrap sm:table-cell">{r.campaign ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
