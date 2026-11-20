"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RegionMetric } from "@/server/geo/stats";
import { SeverityChip } from "./SeverityChip";

type Key = "name" | "county" | "observed" | "prev" | "rate" | "change" | "z";

/** "View as table": the same numbers as the map, sortable, keyboard accessible. */
export function MapTable({ rows, onSelect, hasPopulation }: { rows: RegionMetric[]; onSelect: (code: string) => void; hasPopulation: boolean }) {
  const t = useTranslations("geo.table");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "observed", dir: -1 });
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * sort.dir;
    return ((av ?? -Infinity) - (bv ?? -Infinity)) * sort.dir;
  }), [rows, sort]);
  const head = (key: Key, label: string, numeric = false) => (
    <TableHead aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={numeric ? "text-right" : undefined}>
      <button type="button" className="inline-flex items-center gap-1 hover:underline" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : numeric ? -1 : 1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />) : <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />}
      </button>
    </TableHead>
  );
  return (
    <div className="max-h-[72vh] overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            {head("name", t("municipality"))}
            {head("county", t("county"))}
            {head("observed", t("count"), true)}
            {head("prev", t("previous"), true)}
            {hasPopulation && head("rate", t("rate"), true)}
            {head("change", t("change"), true)}
            {head("z", t("z"), true)}
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.code}>
              <TableCell><button type="button" className="font-medium text-primary hover:underline" onClick={() => onSelect(r.code)}>{r.name}</button></TableCell>
              <TableCell className="text-muted-foreground">{r.county}</TableCell>
              <TableCell className="text-right font-mono">{r.observed}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">{r.prev}</TableCell>
              {hasPopulation && <TableCell className="text-right font-mono">{r.rate === null ? "—" : r.rate.toFixed(1)}</TableCell>}
              <TableCell className="text-right font-mono">{r.change === null ? "—" : `${r.change > 0 ? "+" : ""}${Math.round(r.change * 100)}%`}</TableCell>
              <TableCell className="text-right font-mono">{r.lowData ? "—" : r.z.toFixed(1)}</TableCell>
              <TableCell>{r.lowData ? <span className="text-xs text-muted-foreground">{t("lowData")}</span> : r.severity ? <SeverityChip severity={r.severity} /> : null}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
