"use client";

import { Link2, UserCheck, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignReports, linkReportsToCampaign, setReportStatus } from "@/app/[locale]/soc/_actions/reports";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "@/i18n/navigation";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InboxRow, ReportStatus } from "@/server/queries/soc";

const KEY_STATUS: Record<string, ReportStatus> = { "1": "under_review", "2": "confirmed", "3": "not_scam", "4": "takedown_requested", "5": "duplicate" };

/** A2 triage inbox: J/K, Enter, X, 1–5, bulk actions, optimistic updates with rollback. */
export function InboxTable({ rows }: { rows: InboxRow[] }) {
  const t = useTranslations("soc.inbox");
  const ts = useTranslations("reportStatus");
  const tc = useTranslations("channel");
  const tu = useTranslations("ui");
  const locale = useLocale();
  const router = useRouter();
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [, start] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(rows, (state, patch: { ids: string[]; status?: ReportStatus; assignee?: string }) =>
    state.map((r) => (patch.ids.includes(r.id) ? { ...r, ...(patch.status ? { status: patch.status } : {}), ...(patch.assignee ? { assignee: patch.assignee } : {}) } : r)),
  );
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  function changeStatus(ids: string[], status: ReportStatus) {
    start(async () => {
      applyOptimistic({ ids, status });
      const res = await setReportStatus({ ids, status });
      if (res.ok) toast.success(`${ts(status)} · ${res.data.count}`);
      else toast.error(res.error === "forbidden" ? tu("errorForbidden") : tu("errorGeneric"));
      router.refresh();
    });
  }

  function assignMe(ids: string[]) {
    start(async () => {
      applyOptimistic({ ids, assignee: "…" });
      const res = await assignReports({ ids, assignee: "me" });
      if (!res.ok) toast.error(tu("errorGeneric"));
      router.refresh();
    });
  }

  function link(ids: string[]) {
    start(async () => {
      const res = await linkReportsToCampaign({ ids, code: code.trim() });
      if (res.ok) toast.success(res.data.code);
      else toast.error(res.error === "notFound" ? tu("empty") : tu("errorGeneric"));
      setSelected(new Set());
      router.refresh();
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      const row = optimistic[cursor];
      if (e.key === "j") setCursor((c) => Math.min(optimistic.length - 1, c + 1));
      else if (e.key === "k") setCursor((c) => Math.max(0, c - 1));
      else if (e.key === "Enter" && row) router.push(`/soc/inbox/${row.id}`);
      else if (e.key === "x" && row) setSelected((s) => { const n = new Set(s); if (n.has(row.id)) n.delete(row.id); else n.add(row.id); return n; });
      else if (KEY_STATUS[e.key] && row) changeStatus(selected.size ? [...selected] : [row.id], KEY_STATUS[e.key]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    rowRefs.current[cursor]?.focus({ preventScroll: false });
  }, [cursor]);

  if (!rows.length) return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  const ids = [...selected];

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-card p-2 text-sm shadow-sm" role="region" aria-label={t("selected", { count: selected.size })}>
          <span className="font-medium">{t("selected", { count: selected.size })}</span>
          <Button size="sm" variant="outline" onClick={() => assignMe(ids)}><UserCheck className="size-4" aria-hidden="true" />{t("bulkAssignMe")}</Button>
          <Button size="sm" variant="outline" onClick={() => changeStatus(ids, "not_scam")}><XCircle className="size-4" aria-hidden="true" />{t("bulkNotScam")}</Button>
          <Popover>
            <PopoverTrigger asChild><Button size="sm" variant="outline"><Link2 className="size-4" aria-hidden="true" />{t("bulkLink")}</Button></PopoverTrigger>
            <PopoverContent className="w-64 space-y-2">
              <label htmlFor="link-code" className="text-xs text-muted-foreground">{t("campaignCode")}</label>
              <Input id="link-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="F019 / C-2026-0001" className="font-mono" />
              <Button size="sm" className="w-full" disabled={!code.trim()} onClick={() => link(ids)}>{tu("apply")}</Button>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{tu("clear")}</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader className="sticky top-0 bg-card/95 backdrop-blur">
            <TableRow>
              <TableHead className="w-8"><Checkbox aria-label={tu("all")} checked={selected.size === optimistic.length} onCheckedChange={(v) => setSelected(v ? new Set(optimistic.map((r) => r.id)) : new Set())} /></TableHead>
              <TableHead>{t("columns.protocol")}</TableHead>
              <TableHead>{t("columns.flag")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("columns.channel")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("columns.institution")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("columns.campaign")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("columns.assignee")}</TableHead>
              <TableHead className="text-right">{t("columns.age")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {optimistic.map((r, i) => (
              <TableRow
                key={r.id}
                ref={(el) => { rowRefs.current[i] = el; }}
                tabIndex={i === cursor ? 0 : -1}
                aria-selected={selected.has(r.id)}
                data-state={selected.has(r.id) ? "selected" : undefined}
                onClick={() => router.push(`/soc/inbox/${r.id}`)}
                onFocus={() => setCursor(i)}
                className={cn("cursor-pointer outline-none", i === cursor && "bg-accent/60 ring-1 ring-ring ring-inset")}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={r.protocol} checked={selected.has(r.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(r.id); else n.delete(r.id); return n; })} />
                </TableCell>
                <TableCell>
                  <p className="font-mono text-xs">{r.protocol}</p>
                  <p className="max-w-64 truncate text-xs text-muted-foreground">{r.excerpt}</p>
                </TableCell>
                <TableCell>{r.flag ? <FlagBadge flag={r.flag} score={r.score} /> : "—"}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{r.channel ? tc(r.channel) : "—"}</TableCell>
                <TableCell className="hidden text-xs lg:table-cell">{r.institution ?? "—"}</TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">{r.campaign ?? "—"}</TableCell>
                <TableCell><Badge variant={r.status === "received" ? "default" : "outline"} className="whitespace-nowrap">{ts(r.status)}</Badge></TableCell>
                <TableCell className="hidden text-xs md:table-cell">{r.assignee ?? "—"}</TableCell>
                <TableCell className="text-right text-xs whitespace-nowrap text-muted-foreground">{fmtAgo(r.created_at, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
