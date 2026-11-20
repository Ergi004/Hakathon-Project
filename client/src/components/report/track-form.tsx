"use client";

import { Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { trackReport } from "@/app/[locale]/(public)/track/actions";
import { StatusTimeline, type TimelineStep } from "@/components/shared/status-timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { fmtDateTime } from "@/lib/format";
import type { PublicTimeline } from "@/server/tracking";

const ORDER = ["received", "under_review", "confirmed", "takedown_requested", "taken_down"] as const;

export function TrackForm({ initialProtocol = "" }: { initialProtocol?: string }) {
  const t = useTranslations("track");
  const ts = useTranslations("reportStatus");
  const tu = useTranslations("ui");
  const locale = useLocale();
  const [protocol, setProtocol] = useState(initialProtocol);
  const [token, setToken] = useState("");
  const [data, setData] = useState<PublicTimeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await trackReport({ protocol, token });
      if (res.ok) setData(res.data);
      else {
        setData(null);
        setError(res.error === "rateLimited" ? tu("rateLimited") : t("notFound"));
      }
    });
  }

  let steps: TimelineStep[] = [];
  if (data) {
    const reached = new Map(data.steps.map((s) => [s.status, s.at]));
    const currentIdx = ORDER.indexOf(data.status as (typeof ORDER)[number]);
    steps = ORDER.map((s, i) => ({
      key: s,
      label: ts(s),
      at: reached.get(s) ? fmtDateTime(reached.get(s)!, locale) : null,
      state: currentIdx === -1 ? (i === 0 ? "done" : "skipped") : i < currentIdx ? "done" : i === currentIdx ? (s === "taken_down" ? "done" : "current") : "pending",
    }));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="glass-card grid gap-4 rounded-2xl p-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end md:p-6">
        <div className="space-y-1.5">
          <Label htmlFor="t-protocol">{t("protocol")}</Label>
          <Input id="t-protocol" value={protocol} onChange={(e) => setProtocol(e.target.value.toUpperCase())} placeholder={t("protocolPlaceholder")} className="font-mono" autoComplete="off" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-token">{t("token")}</Label>
          <Input id="t-token" value={token} onChange={(e) => setToken(e.target.value.trim())} className="font-mono" autoComplete="off" spellCheck={false} required />
        </div>
        <Button type="submit" disabled={pending}>{pending ? t("loading") : t("submit")}</Button>
      </form>

      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}

      {data && (
        <section className="glass-card space-y-5 rounded-2xl p-5 md:p-6" aria-live="polite">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{data.protocol}</p>
            <h2 className="font-display text-xl font-bold">{t("status")}: {ts(data.status)}</h2>
            <p className="text-sm text-muted-foreground">{t("received", { date: fmtDateTime(data.createdAt, locale) })}</p>
          </div>
          {data.status === "not_scam" || data.status === "duplicate" ? (
            <Alert><Info className="size-4" /><AlertDescription>{data.status === "not_scam" ? t("notScam") : t("duplicate")}</AlertDescription></Alert>
          ) : (
            <StatusTimeline steps={steps} />
          )}
          {data.campaignCode && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/threats/${encodeURIComponent(data.campaignCode)}`}>{t("campaign", { code: data.campaignCode })}</Link>
            </Button>
          )}
        </section>
      )}
      <p className="text-sm text-muted-foreground">{t("help")}</p>
    </div>
  );
}
