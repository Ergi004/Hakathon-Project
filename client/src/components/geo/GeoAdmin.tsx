"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createGeoAlertRule, deleteGeoAlertRule, saveGeoThresholds, setGeoAlertRuleActive } from "@/app/[locale]/soc/_actions/geo-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import { isMunicipalityCode, MUNICIPALITIES, regionName } from "@/lib/geo/regions";
import type { Thresholds } from "@/server/geo/hotspots";

export interface RuleRow { id: string; name: string; min_reports: number; min_zscore: number; min_spike_ratio: number; active: boolean; institution: string | null; regionCode: string | null }

const ANY = "__any";

/** Lead-only configuration of hot-zone thresholds and alert rules (every change is audited). */
export function GeoAdmin({ thresholds, rules, institutions }: { thresholds: Thresholds; rules: RuleRow[]; institutions: { id: string; name: string }[] }) {
  const t = useTranslations("geo.admin");
  const tsev = useTranslations("geo.severity");
  const tu = useTranslations("ui");
  const locale = useLocale();
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [th, setTh] = useState(thresholds);
  const preRegion = sp.get("region");
  const [rule, setRule] = useState({ name: preRegion && isMunicipalityCode(preRegion) ? t("ruleNameFor", { name: regionName(preRegion, locale) }) : "", minReports: 5, minZ: 2, minSpike: 3, institutionId: null as string | null, regionCode: preRegion && isMunicipalityCode(preRegion) ? preRegion : null });

  const run = (fn: () => Promise<{ ok: boolean }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { toast.success(tu("saved")); after?.(); router.refresh(); } else toast.error(tu("errorGeneric"));
  });
  const num = (id: string, label: string, value: number, onChange: (v: number) => void, step = 1) => (
    <div className="space-y-1"><Label htmlFor={id} className="text-xs">{label}</Label><Input id={id} type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-24" /></div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="glass-card space-y-4 rounded-xl p-4">
        <h3 className="font-medium">{t("thresholds")}</h3>
        <p className="text-xs text-muted-foreground">{t("thresholdsHint")}</p>
        {(["watch", "elevated", "critical"] as const).map((lvl) => (
          <fieldset key={lvl} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">{tsev(lvl)}</legend>
            {num(`${lvl}-n`, t("minReports"), th[lvl].minObserved, (v) => setTh({ ...th, [lvl]: { ...th[lvl], minObserved: v } }))}
            {num(`${lvl}-z`, t("minZ"), th[lvl].minZ, (v) => setTh({ ...th, [lvl]: { ...th[lvl], minZ: v } }), 0.1)}
            {lvl === "critical" && num("critical-s", t("minSpike"), th.critical.minSpike, (v) => setTh({ ...th, critical: { ...th.critical, minSpike: v } }), 0.1)}
          </fieldset>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          {num("win", t("windowDays"), th.windowDays, (v) => setTh({ ...th, windowDays: v }))}
          {num("base", t("baselineDays"), th.baselineDays, (v) => setTh({ ...th, baselineDays: v }))}
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => saveGeoThresholds(th))}>{tu("save")}</Button>
        </div>
      </section>

      <section className="glass-card space-y-4 rounded-xl p-4">
        <h3 className="font-medium">{t("rules")}</h3>
        <ul className="space-y-2">
          {rules.length === 0 && <li className="text-sm text-muted-foreground">{t("noRules")}</li>}
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{t("ruleLine", { n: r.min_reports, z: r.min_zscore, s: r.min_spike_ratio })}{r.regionCode ? ` · ${regionName(r.regionCode, locale)}` : ""}{r.institution ? ` · ${r.institution}` : ""}</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs"><Switch checked={r.active} onCheckedChange={(v) => run(() => setGeoAlertRuleActive({ id: r.id, active: v }))} />{t("active")}</label>
              <Button type="button" size="icon" variant="ghost" aria-label={t("deleteRule", { name: r.name })} onClick={() => run(() => deleteGeoAlertRule({ id: r.id }))}><Trash2 className="size-4" aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
        <form className="space-y-3 rounded-lg border border-dashed border-border p-3" onSubmit={(e) => { e.preventDefault(); run(() => createGeoAlertRule(rule), () => setRule({ ...rule, name: "" })); }}>
          <h4 className="text-sm font-medium">{t("newRule")}</h4>
          <div className="space-y-1"><Label htmlFor="rule-name" className="text-xs">{t("ruleName")}</Label><Input id="rule-name" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} required minLength={2} /></div>
          <div className="flex flex-wrap gap-3">
            {num("r-n", t("minReports"), rule.minReports, (v) => setRule({ ...rule, minReports: v }))}
            {num("r-z", t("minZ"), rule.minZ, (v) => setRule({ ...rule, minZ: v }), 0.1)}
            {num("r-s", t("minSpike"), rule.minSpike, (v) => setRule({ ...rule, minSpike: v }), 0.1)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="r-region" className="text-xs">{t("region")}</Label>
              <Select value={rule.regionCode ?? ANY} onValueChange={(v) => setRule({ ...rule, regionCode: v === ANY ? null : v })}>
                <SelectTrigger id="r-region" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>{t("anyRegion")}</SelectItem>{[...MUNICIPALITIES].sort((a, b) => a.name_sq.localeCompare(b.name_sq, "sq")).map((m) => <SelectItem key={m.code} value={m.code}>{regionName(m.code, locale)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="r-inst" className="text-xs">{t("institution")}</Label>
              <Select value={rule.institutionId ?? ANY} onValueChange={(v) => setRule({ ...rule, institutionId: v === ANY ? null : v })}>
                <SelectTrigger id="r-inst" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ANY}>{t("anyInstitution")}</SelectItem>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" size="sm" disabled={pending}>{t("addRule")}</Button>
        </form>
      </section>
    </div>
  );
}
