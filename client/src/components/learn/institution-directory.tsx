"use client";

import { Building2, Globe, MessageSquare, Phone, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { DefangedText } from "@/components/shared/defanged-text";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DirectoryEntry } from "@/server/queries/public";

const ANY = "__any";

/** SPEC 7 /institutions: search + sector filter over official domains and channels. */
export function InstitutionDirectory({ entries }: { entries: DirectoryEntry[] }) {
  const t = useTranslations("institutions");
  const ts = useTranslations("sector");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState(ANY);
  const sectors = [...new Set(entries.map((e) => e.sector))];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (sector === ANY || e.sector === sector) &&
        (!needle || e.name.toLowerCase().includes(needle) || e.domains.some((d) => d.includes(needle)) || e.channels.some((c) => c.value.toLowerCase().includes(needle))),
    );
  }, [entries, q, sector]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="inst-q" className="text-xs text-muted-foreground">{t("search")}</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="inst-q" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" type="search" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inst-sector" className="text-xs text-muted-foreground">{t("sector")}</Label>
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger id="inst-sector" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("anySector")}</SelectItem>
              {sectors.map((s) => <SelectItem key={s} value={s}>{ts(s as "bank")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">{t("count", { count: filtered.length })}</p>
      {!filtered.length ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filtered.map((e) => (
            <li key={e.id} className="glass-card space-y-3 rounded-xl p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="inline-flex items-center gap-2 font-display text-lg font-medium"><Building2 className="size-5 text-primary" aria-hidden="true" />{e.name}</h2>
                <Badge variant="outline">{ts(e.sector as "bank")}</Badge>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t("domains")}</p>
                {e.domains.length ? e.domains.map((d) => (
                  <p key={d} className="flex items-center gap-2 text-sm"><Globe className="size-4 shrink-0 text-flag-green" aria-hidden="true" /><DefangedText value={d} revealable={false} /></p>
                )) : <p className="text-sm text-muted-foreground">—</p>}
              </div>
              {e.channels.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{t("channels")}</p>
                  {e.channels.map((c) => (
                    <p key={`${c.kind}:${c.value}`} className="flex items-center gap-2 text-sm">
                      {c.kind === "phone" ? <Phone className="size-4 text-muted-foreground" aria-hidden="true" /> : <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />}
                      <span className="text-muted-foreground">{t(`kinds.${c.kind as "phone"}`)}:</span>
                      <span className="font-mono">{c.value}</span>
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
