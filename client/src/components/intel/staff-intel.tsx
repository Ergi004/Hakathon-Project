"use client";

import { Ban, Gavel, Radar, ScanSearch } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { addBlocklistEntry } from "@/app/[locale]/soc/_actions/intel";
import { runDeepScan, scanReportNow } from "@/app/[locale]/soc/_actions/intel-scan";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/server/supabase/client";
import { IntelPanel, type IntelState } from "./intel-panel";

/** SOC Intel tab: same rows as the citizen card plus links and analyst actions; Realtime refresh (RLS: staff). */
export function StaffIntel({ reportId, state, domain, campaignId, hasUrl }: { reportId: string; state: IntelState | null; domain: string | null; campaignId: string | null; hasUrl: boolean }) {
  const t = useTranslations("intel");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  const last = useRef(0);

  useEffect(() => {
    let client: ReturnType<typeof createBrowserClient> | null = null;
    try { client = createBrowserClient(); } catch { client = null; }
    if (!client) return;
    const refresh = () => {
      if (Date.now() - last.current < 700) return;
      last.current = Date.now();
      router.refresh();
    };
    const ch = client.channel(`intel-${reportId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scan_results" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "scans" }, refresh)
      .subscribe();
    const poll = state?.status === "running" ? setInterval(() => router.refresh(), 5000) : null;
    return () => { client?.removeChannel(ch); if (poll) clearInterval(poll); };
  }, [reportId, router, state?.status]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast.success(ok); router.refresh(); }
      else toast.error(r.message && r.message !== "no_url" ? t("notEligible", { reason: t.has(`reasons.${r.message}` as "reasons.private") ? t(`reasons.${r.message}` as "reasons.private") : r.message }) : tu("errorGeneric"));
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="toolbar">
        {hasUrl && <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => scanReportNow({ reportId }), t("running"))}><ScanSearch className="size-4" aria-hidden="true" />{t("rescan")}</Button>}
        {hasUrl && (
          <div className="space-y-1">
            <Button size="sm" disabled={pending} onClick={() => act(() => runDeepScan({ reportId }), t("deepStarted"))}><Radar className="size-4" aria-hidden="true" />{t("runDeep")}</Button>
          </div>
        )}
        {domain && <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => addBlocklistEntry({ type: "domain", value: domain, reason: "Confirmed by threat intelligence" }), tu("saved"))}><Ban className="size-4" aria-hidden="true" />{t("addBlocklist")}</Button>}
        {campaignId && <Button size="sm" variant="secondary" asChild><Link href={`/soc/campaigns/${campaignId}?tab=takedowns`}><Gavel className="size-4" aria-hidden="true" />{t("createTakedown")}</Link></Button>}
      </div>
      {hasUrl && <p className="text-xs text-muted-foreground">{t("deepConsentLine")}</p>}
      {state ? <IntelPanel state={state} staff /> : <Alert><AlertDescription>{t("noScans")}</AlertDescription></Alert>}
    </div>
  );
}
