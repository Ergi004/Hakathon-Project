"use client";

import { BellPlus, ExternalLink, Megaphone, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { addRegionNote } from "@/app/[locale]/soc/geo/actions";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import type { RegionDetail } from "@/server/geo/stats";
import { SeverityChip } from "./SeverityChip";

function Bars({ items, label }: { items: { name: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5" aria-label={label}>
      {items.map((i) => (
        <li key={i.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 text-sm">
          <span className="truncate">{i.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{i.count}</span>
          <span className="col-span-2 h-1.5 rounded-full bg-muted" aria-hidden="true"><span className="block h-full rounded-full bg-[var(--geo-4)]" style={{ width: `${(100 * i.count) / max}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

/** Region drill-down. Aggregates and masked rows only: no text, contacts or tracking tokens. */
export function RegionDetailView({ d, query, mode, showOpenPage = true }: { d: RegionDetail; query: string; mode: "victim" | "imitated"; showOpenPage?: boolean }) {
  const t = useTranslations("geo.region");
  const tc = useTranslations("channel");
  const tu = useTranslations("ui");
  const locale = useLocale();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const topCampaign = d.campaigns[0];

  const save = () => start(async () => {
    const r = await addRegionNote({ code: d.code, body: note });
    if (r.ok) { setNote(""); toast.success(tu("saved")); router.refresh(); }
    else toast.error(tu("errorGeneric"));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{t("county", { name: d.county })}</p>
          <p className="text-xs text-muted-foreground">{d.population ? t("population", { n: d.population.toLocaleString(locale), year: d.populationYear ?? "" }) : t("populationUnknown")}</p>
        </div>
        {d.hotspot && <SeverityChip severity={d.hotspot.severity} />}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {([["h24", d.counts.h24], ["d7", d.counts.d7], ["d30", d.counts.d30]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border p-3 text-center">
            <dt className="text-xs text-muted-foreground">{t(`counts.${k}`)}</dt>
            <dd className="font-display text-2xl">{v}</dd>
          </div>
        ))}
      </dl>
      {d.rate30 !== null && <p className="text-sm">{t("rate", { rate: d.rate30.toFixed(1) })}</p>}

      <section className="space-y-1">
        <h3 className="text-sm font-medium">{t("trend")}</h3>
        <div className="h-24" role="img" aria-label={t("trendAria", { total: d.counts.d30 })}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="day" hide />
              <Tooltip formatter={(v) => [String(v), t("reports")]} labelFormatter={(l) => new Date(`${l}T12:00:00Z`).toLocaleDateString(locale)} />
              <Area dataKey="count" type="monotone" stroke="var(--geo-5)" fill="var(--geo-4)" fillOpacity={0.35} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="space-y-2"><h3 className="text-sm font-medium">{t("institutions")}</h3>{d.institutions.length ? <Bars items={d.institutions} label={t("institutions")} /> : <p className="text-sm text-muted-foreground">{tu("noData")}</p>}</section>
        <section className="space-y-2"><h3 className="text-sm font-medium">{t("tactics")}</h3>{d.tactics.length ? <Bars items={d.tactics.map((x) => ({ ...x, name: x.name.replace(/_/g, " ") }))} label={t("tactics")} /> : <p className="text-sm text-muted-foreground">{tu("noData")}</p>}</section>
        <section className="space-y-2 sm:col-span-2"><h3 className="text-sm font-medium">{t("channels")}</h3>{d.channels.length ? <Bars items={d.channels.map((x) => ({ ...x, name: tc(x.name as "sms") }))} label={t("channels")} /> : <p className="text-sm text-muted-foreground">{tu("noData")}</p>}</section>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("campaigns")}</h3>
        {d.campaigns.length ? (
          <ul className="flex flex-wrap gap-2">
            {d.campaigns.map((c) => (
              <li key={c.id}><Link href={`/soc/campaigns/${c.id}?tab=geography`} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"><span className="font-mono">{c.code}</span>{c.label && <span className="max-w-40 truncate text-muted-foreground">{c.label}</span>}<span className="font-mono">· {c.count}</span></Link></li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{tu("noData")}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{mode === "victim" ? t("latestVictim") : t("latestImitated")}</h3>
        {d.reports.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {d.reports.map((r) => (
              <li key={r.id}>
                <Link href={`/soc/inbox/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5 text-sm hover:bg-muted/50">
                  <span className="font-mono text-xs">{r.protocol}</span>
                  {r.flag && <FlagBadge flag={r.flag as "red"} />}
                  <span className="text-xs text-muted-foreground">{r.channel ? tc(r.channel as "sms") : "—"}</span>
                  <time className="ml-auto text-xs text-muted-foreground" dateTime={r.hour}>{new Date(r.hour).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{tu("noData")}</p>}
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("notes")}</h3>
        <div className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} aria-label={t("notePlaceholder")} placeholder={t("notePlaceholder")} />
          <Button type="button" size="sm" disabled={pending || !note.trim()} onClick={save}><Send className="size-4" aria-hidden="true" />{t("addNote")}</Button>
        </div>
        {d.notes.length > 0 && (
          <ul className="space-y-2">
            {d.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border p-2.5 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.author} · {new Date(n.at).toLocaleString(locale)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button asChild size="sm"><Link href={`/soc/advisories?region=${d.code}${topCampaign ? `&campaign=${topCampaign.id}` : ""}`}><Megaphone className="size-4" aria-hidden="true" />{t("createAdvisory")}</Link></Button>
        <Button asChild size="sm" variant="outline"><Link href={`/soc/admin?tab=geo&region=${d.code}`}><BellPlus className="size-4" aria-hidden="true" />{t("createRule")}</Link></Button>
        {showOpenPage && <Button asChild size="sm" variant="ghost"><Link href={`/soc/geo/${d.code}${query ? `?${query}` : ""}`}><ExternalLink className="size-4" aria-hidden="true" />{t("openPage")}</Link></Button>}
      </div>
    </div>
  );
}
