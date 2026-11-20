"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAlertRule, deleteAlertRule, toggleAlertRule } from "@/app/[locale]/soc/_actions/intel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";

const METRICS = ["reports_per_hour", "reports_per_day", "high_risk_per_hour", "new_domains_per_day"] as const;

export function AlertRuleForm({ institutions }: { institutions: string[] }) {
  const t = useTranslations("soc.alerts");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [v, setV] = useState({ name: "", metric: "reports_per_hour", op: ">", value: 20, institution: "__any", channel: "in_app" });
  const [pending, start] = useTransition();
  return (
    <form className="glass-card grid gap-3 rounded-xl p-4 md:grid-cols-3 lg:grid-cols-[1fr_12rem_6rem_6rem_12rem_9rem_auto] lg:items-end" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await createAlertRule({ ...v, institution: v.institution === "__any" ? undefined : v.institution });
        if (r.ok) { toast.success(tu("saved")); setV({ ...v, name: "" }); router.refresh(); } else toast.error(tu("errorInvalid"));
      });
    }}>
      <div className="space-y-1.5"><Label htmlFor="ar-name">{t("name")}</Label><Input id="ar-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></div>
      <div className="space-y-1.5"><Label htmlFor="ar-metric">{t("metric")}</Label>
        <Select value={v.metric} onValueChange={(x) => setV({ ...v, metric: x })}><SelectTrigger id="ar-metric" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{METRICS.map((m) => <SelectItem key={m} value={m}>{t(`metrics.${m}`)}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="ar-op">{t("op")}</Label>
        <Select value={v.op} onValueChange={(x) => setV({ ...v, op: x })}><SelectTrigger id="ar-op" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{[">", ">=", "<"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="ar-value">{t("value")}</Label><Input id="ar-value" type="number" min={0} value={v.value} onChange={(e) => setV({ ...v, value: Number(e.target.value) })} /></div>
      <div className="space-y-1.5"><Label htmlFor="ar-inst">{t("institution")}</Label>
        <Select value={v.institution} onValueChange={(x) => setV({ ...v, institution: x })}><SelectTrigger id="ar-inst" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="__any">{tu("all")}</SelectItem>{institutions.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="ar-ch">{t("channel")}</Label>
        <Select value={v.channel} onValueChange={(x) => setV({ ...v, channel: x })}><SelectTrigger id="ar-ch" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{(["in_app", "email"] as const).map((c) => <SelectItem key={c} value={c}>{t(`channels.${c}`)}</SelectItem>)}</SelectContent></Select></div>
      <Button type="submit" disabled={pending || v.name.trim().length < 3}><Plus className="size-4" aria-hidden="true" />{t("new")}</Button>
    </form>
  );
}

export function RuleRowActions({ id, active, name }: { id: string; active: boolean; name: string }) {
  const t = useTranslations("soc.alerts");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex items-center gap-2 text-xs">
        <Switch checked={active} disabled={pending} onCheckedChange={(x) => start(async () => { await toggleAlertRule({ id, active: x }); router.refresh(); })} aria-label={`${t("active")}: ${name}`} />
        {t("active")}
      </label>
      <Button variant="ghost" size="icon" className="size-8" aria-label={`${tu("delete")}: ${name}`} disabled={pending} onClick={() => start(async () => { await deleteAlertRule({ id }); router.refresh(); })}><Trash2 className="size-4" /></Button>
    </div>
  );
}
