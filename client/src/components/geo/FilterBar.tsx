"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePathname, useRouter } from "@/i18n/navigation";
import { FLAGS_ORDER, filtersToQuery, type GeoFilters } from "@/lib/geo/filters";
import type { GeoData } from "@/server/geo/stats";

const ALL = "__all";

/** All filters live in the URL, so every view can be shared. */
export function FilterBar({ filters, options }: { filters: GeoFilters; options: GeoData["options"] }) {
  const t = useTranslations("geo.filters");
  const tc = useTranslations("channel");
  const tf = useTranslations("flags");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const go = (patch: Partial<GeoFilters>) => {
    const q = filtersToQuery({ ...filters, ...patch });
    start(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false }));
  };

  const sel = (id: string, label: string, value: string | undefined, items: { value: string; label: string }[], onValue: (v: string | undefined) => void) => (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onValue(v === ALL ? undefined : v)}>
        <SelectTrigger id={id} size="sm" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("all")}</SelectItem>
          {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <section className="glass-card space-y-3 rounded-xl p-3" aria-label={t("label")} aria-busy={pending}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground" id="geo-range">{t("range")}</span>
          <ToggleGroup type="single" variant="outline" size="sm" value={filters.range} onValueChange={(v) => v && go({ range: v as GeoFilters["range"] })} aria-labelledby="geo-range">
            {(["24h", "7d", "30d", "custom"] as const).map((r) => <ToggleGroupItem key={r} value={r}>{t(`ranges.${r}`)}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        {filters.range === "custom" && (
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label htmlFor="geo-from" className="text-xs text-muted-foreground">{t("from")}</Label><Input id="geo-from" type="date" className="h-8 w-38" defaultValue={filters.from} onBlur={(e) => e.target.value && go({ from: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="geo-to" className="text-xs text-muted-foreground">{t("to")}</Label><Input id="geo-to" type="date" className="h-8 w-38" defaultValue={filters.to} onBlur={(e) => e.target.value && go({ to: e.target.value })} /></div>
          </div>
        )}
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground" id="geo-mode">{t("mode")}</span>
          <ToggleGroup type="single" variant="outline" size="sm" value={filters.mode} onValueChange={(v) => v && go({ mode: v as GeoFilters["mode"] })} aria-labelledby="geo-mode">
            <ToggleGroupItem value="victim">{t("modes.victim")}</ToggleGroupItem>
            <ToggleGroupItem value="imitated">{t("modes.imitated")}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <label className="inline-flex items-center gap-2 pb-1 text-sm"><Switch checked={filters.confirmed} onCheckedChange={(v) => go({ confirmed: v })} />{t("confirmed")}</label>
        <label className="inline-flex items-center gap-2 pb-1 text-sm"><Switch checked={filters.compare} onCheckedChange={(v) => go({ compare: v })} />{t("compare")}</label>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => start(() => router.replace(pathname, { scroll: false }))}><RotateCcw className="size-4" aria-hidden="true" />{t("reset")}</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {sel("geo-inst", t("institution"), filters.institution, options.institutions.map((i) => ({ value: i.id, label: i.name })), (v) => go({ institution: v }))}
        {sel("geo-camp", t("campaign"), filters.campaign, options.campaigns.map((c) => ({ value: c.code, label: c.label })), (v) => go({ campaign: v }))}
        {sel("geo-tactic", t("tactic"), filters.tactic, options.tactics.map((x) => ({ value: x, label: x.replace(/_/g, " ") })), (v) => go({ tactic: v }))}
        {sel("geo-channel", t("channel"), filters.channel, (["sms", "email", "social", "web", "qr", "call", "other"] as const).map((c) => ({ value: c, label: tc(c) })), (v) => go({ channel: v as GeoFilters["channel"] }))}
        {sel("geo-flag", t("minFlag"), filters.minFlag, FLAGS_ORDER.map((f) => ({ value: f, label: tf(f) })), (v) => go({ minFlag: v as GeoFilters["minFlag"] }))}
        {sel("geo-source", t("source"), filters.source, (["citizen", "extension", "business"] as const).map((s) => ({ value: s, label: t(`sources.${s}`) })), (v) => go({ source: v as GeoFilters["source"] }))}
      </div>
    </section>
  );
}
