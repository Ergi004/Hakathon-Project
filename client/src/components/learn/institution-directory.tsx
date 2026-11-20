"use client";

import { BadgeCheck, Banknote, Building, Building2, Globe, Landmark, Mail, MessageSquare, Package, Phone, Radio, Search, Share2, Siren, X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { DefangedText } from "@/components/shared/defanged-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DirectoryEntry } from "@/server/queries/public";

const ALL = "__all";

const SECTOR_ICON: Record<string, typeof Building2> = {
  government: Landmark,
  municipality: Building,
  bank: Banknote,
  postal: Package,
  utility: Zap,
  telecom: Radio,
  police: Siren,
};

const CHANNEL_ICON: Record<string, typeof Phone> = { phone: Phone, sms_sender: MessageSquare, social: Share2, email: Mail };

/** SPEC 7 /institutions: search + sector filter over official domains and channels. */
export function InstitutionDirectory({ entries }: { entries: DirectoryEntry[] }) {
  const t = useTranslations("institutions");
  const ts = useTranslations("sector");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState(ALL);
  const sectors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.sector, (counts.get(e.sector) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hasContacts = (e: DirectoryEntry) => e.domains.length + e.channels.length > 0;
    return entries
      .filter(
        (e) =>
          (sector === ALL || e.sector === sector) &&
          (!needle || e.name.toLowerCase().includes(needle) || e.domains.some((d) => d.includes(needle)) || e.channels.some((c) => c.value.toLowerCase().includes(needle))),
      )
      .sort((a, b) => Number(hasContacts(b)) - Number(hasContacts(a)) || a.name.localeCompare(b.name));
  }, [entries, q, sector]);

  return (
    <div className="space-y-6">
      {/* Search and sector filter */}
      <Card className="py-0">
        <CardContent className="space-y-4 py-4">
          <div className="group/search relative">
            <Label htmlFor="inst-q" className="sr-only">{t("search")}</Label>
            <span className="pointer-events-none absolute top-1/2 left-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg bg-primary/12 text-primary">
              <Search className="size-[1.1rem]" aria-hidden="true" />
            </span>
            <Input
              id="inst-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search")}
              autoComplete="off"
              className="h-14 rounded-xl border-2 bg-background pr-14 pl-14 text-base shadow-sm transition-colors focus-visible:border-primary md:text-lg [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-2.5 size-9 -translate-y-1/2 rounded-lg"
                onClick={() => setQ("")}
                aria-label={t("clearSearch")}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={sector}
            onValueChange={(v) => setSector(v || ALL)}
            aria-label={t("sector")}
            className="flex-wrap"
          >
            <ToggleGroupItem value={ALL} className="px-3">
              {t("allSectors")} <span className="text-muted-foreground tabular-nums">{entries.length}</span>
            </ToggleGroupItem>
            {sectors.map(([s, n]) => {
              const Icon = SECTOR_ICON[s] ?? Building2;
              return (
                <ToggleGroupItem key={s} value={s} className="gap-1.5 px-3">
                  <Icon className="size-3.5" aria-hidden="true" />
                  {ts(s as "bank")} <span className="text-muted-foreground tabular-nums">{n}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground" aria-live="polite">{t("count", { count: filtered.length })}</p>

      {!filtered.length ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => {
            const Icon = SECTOR_ICON[e.sector] ?? Building2;
            return (
              <li key={e.id}>
                <Card className="h-full gap-0 py-0">
                  <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3 border-b border-border py-4">
                    <span className="row-span-2 grid size-11 place-items-center rounded-xl bg-primary/12 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <CardTitle className="font-display text-lg leading-snug">
                      <h2>{e.name}</h2>
                    </CardTitle>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="font-normal">{ts(e.sector as "bank")}</Badge>
                      <Badge variant="outline" className="gap-1 border-flag-green/40 font-normal text-foreground">
                        <BadgeCheck className="text-flag-green" aria-hidden="true" />
                        {t("verified")}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 py-4">
                    {!e.domains.length && !e.channels.length && (
                      <p className="text-sm text-muted-foreground">{t("noContacts")}</p>
                    )}
                    {e.domains.length > 0 && (
                      <section className="space-y-2">
                        <h3 className="text-xs font-medium text-muted-foreground">{t("domains")}</h3>
                        <ul className="space-y-1.5">
                          {e.domains.map((d) => (
                            <li key={d} className="flex items-center gap-2 rounded-lg bg-flag-green/8 px-2.5 py-1.5 text-sm">
                              <Globe className="size-4 shrink-0 text-flag-green" aria-hidden="true" />
                              <DefangedText value={d} revealable={false} className="min-w-0 flex-1" />
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {e.channels.length > 0 && (
                      <section className="space-y-2">
                        <h3 className="text-xs font-medium text-muted-foreground">{t("channels")}</h3>
                        <dl className="space-y-1.5 text-sm">
                          {e.channels.map((c) => {
                            const CIcon = CHANNEL_ICON[c.kind] ?? MessageSquare;
                            return (
                              <div key={`${c.kind}:${c.value}`} className="flex items-center gap-2">
                                <CIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <dt className="text-muted-foreground">{t(`kinds.${c.kind as "phone"}`)}</dt>
                                <dd className="ml-auto truncate font-mono">{c.value}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </section>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
