"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveThresholds, simulateThresholds } from "@/app/[locale]/soc/_actions/intel";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

const KEYS = ["yellow", "orange", "red", "darkred"] as const;

/** A13: change thresholds and see how many existing messages change flag. */
export function ThresholdSimulator({ initial, canSave }: { initial: Record<(typeof KEYS)[number], number>; canSave: boolean }) {
  const t = useTranslations("soc.quality");
  const tu = useTranslations("ui");
  const [v, setV] = useState(initial);
  const [res, setRes] = useState<{ changed: number; total: number; dist: Record<string, number> } | null>(null);
  const [pending, start] = useTransition();
  const valid = v.yellow < v.orange && v.orange < v.red && v.red < v.darkred;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("simulatorHint")}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {KEYS.map((k) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={`th-${k}`} className="flex items-center justify-between"><FlagBadge flag={k} /><span className="font-mono text-sm">≥ {v[k]}</span></Label>
            <Slider id={`th-${k}`} min={1} max={100} step={1} value={[v[k]]} onValueChange={([x]) => setV({ ...v, [k]: x })} aria-label={k} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={pending || !valid} onClick={() => start(async () => { const r = await simulateThresholds(v); if (r.ok) setRes(r.data); else toast.error(tu("errorGeneric")); })}>{t("simulator")}</Button>
        {canSave ? (
          <Button disabled={pending || !valid} onClick={() => start(async () => { const r = await saveThresholds(v); if (r.ok) toast.success(tu("saved")); else toast.error(tu("errorForbidden")); })}>{t("saveThresholds")}</Button>
        ) : <span className="text-xs text-muted-foreground">{t("adminOnly")}</span>}
      </div>
      {res && (
        <div className="rounded-lg border border-border p-3 text-sm" aria-live="polite">
          <p className="font-medium">{t("changed", { count: res.changed })} / {res.total}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(res.dist).map(([f, n]) => <span key={f} className="inline-flex items-center gap-1"><FlagBadge flag={f as "red"} /><span className="tabular-nums">{n}</span></span>)}
          </div>
        </div>
      )}
    </div>
  );
}
