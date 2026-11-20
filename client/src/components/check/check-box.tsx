"use client";

import jsQR from "jsqr";
import { Fingerprint, ImageUp, Link2, Loader2, MessageSquareText, Phone, QrCode, ScanSearch } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { reportFromCheck, checkAction, type CheckError } from "@/app/[locale]/(public)/check/actions";
import { DefangedText } from "@/components/shared/defanged-text";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { CHANNELS } from "@/lib/schemas/analysis";
import { flagForScore } from "@/lib/flags";
import { cn } from "@/lib/utils";
import type { CheckOutcome } from "@/server/checks";
import { LiveScan } from "@/components/intel/live-scan";
import { CheckResult } from "./check-result";

type Tab = "link" | "message" | "phone" | "qr";
export interface CheckExample {
  label: string;
  tab: Tab;
  value: string;
  sender?: string;
}

const TAB_ICON = { link: Link2, message: MessageSquareText, phone: Phone, qr: QrCode } as const;

/** Glowing command-bar checker (SPEC 3, 7). Used on / and /check. */
export function CheckBox({ examples = [], hero = false }: { examples?: CheckExample[]; hero?: boolean }) {
  const t = useTranslations("check");
  const tc = useTranslations("channel");
  const ti = useTranslations("intel");
  const locale = useLocale() as "sq" | "en";
  const [tab, setTab] = useState<Tab>("link");
  const [values, setValues] = useState<Record<Tab, string>>({ link: "", message: "", phone: "", qr: "" });
  const [sender, setSender] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("sms");
  const [qrError, setQrError] = useState(false);
  const [error, setError] = useState<CheckError | "empty" | null>(null);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [report, setReport] = useState<{ protocol: string; trackingToken: string } | null>(null);
  const [baseScore, setBaseScore] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [reporting, startReporting] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  const value = values[tab];
  const setValue = (v: string) => setValues((s) => ({ ...s, [tab]: v }));

  function submit(e?: React.FormEvent, override?: { tab: Tab; value: string; sender?: string }) {
    e?.preventDefault();
    const activeTab = override?.tab ?? tab;
    const activeValue = (override?.value ?? value).trim();
    if (!activeValue) {
      setError("empty");
      return;
    }
    setError(null);
    setReport(null);
    startTransition(async () => {
      const res = await checkAction({
        tab: activeTab,
        value: activeValue,
        sender: activeTab === "message" ? (override?.sender ?? sender) || undefined : undefined,
        channel: activeTab === "message" ? channel : undefined,
        locale,
      });
      if (res.ok) {
        setOutcome(res.data);
        setBaseScore(res.data.result.score);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } else setError(res.error);
    });
  }

  function onReport() {
    startReporting(async () => {
      const isText = tab === "message";
      const res = await reportFromCheck({
        category: "other",
        channel: tab === "qr" ? "qr" : tab === "phone" ? "call" : isText ? channel : "web",
        text: isText ? value : undefined,
        url: tab === "link" || tab === "qr" ? value : undefined,
        sender: tab === "phone" ? value : isText ? sender || undefined : undefined,
        checkId: outcome?.checkId ?? undefined,
        locale,
      });
      if (res.ok) setReport(res.data);
      else setError(res.error === "rateLimited" ? "rateLimited" : "error");
    });
  }

  async function onQrFile(file: File | undefined) {
    setQrError(false);
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, data.width, data.height);
    if (code?.data) setValues((s) => ({ ...s, qr: code.data }));
    else {
      setValues((s) => ({ ...s, qr: "" }));
      setQrError(true);
    }
  }

  function reset() {
    setOutcome(null);
    setReport(null);
    setValues({ link: "", message: "", phone: "", qr: "" });
    setSender("");
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className={cn(
          "glass-card relative rounded-2xl p-3 md:p-4",
          hero && "shadow-[0_0_80px_-20px_var(--glow)] ring-1 ring-primary/20",
        )}
        aria-busy={pending}
      >
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setError(null); }}>
          <TabsList className="grid w-full grid-cols-4">
            {(Object.keys(TAB_ICON) as Tab[]).map((k) => {
              const Icon = TAB_ICON[k];
              return (
                <TabsTrigger key={k} value={k} className="gap-1.5">
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="text-xs sm:text-sm">{t(`tabs.${k}`)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-3 space-y-3">
            <TabsContent value="link" className="mt-0 space-y-1.5">
              <Label htmlFor="chk-link" className="sr-only">{t("labels.link")}</Label>
              <Input id="chk-link" value={values.link} onChange={(e) => setValue(e.target.value)} placeholder={t("placeholders.link")} inputMode="url" autoComplete="off" spellCheck={false} className="h-12 font-mono text-base" />
            </TabsContent>
            <TabsContent value="message" className="mt-0 space-y-3">
              <Label htmlFor="chk-msg" className="sr-only">{t("labels.message")}</Label>
              <Textarea id="chk-msg" value={values.message} onChange={(e) => setValue(e.target.value)} placeholder={t("placeholders.message")} rows={4} className="min-h-28 text-base" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="chk-sender">{t("labels.sender")}</Label>
                  <Input id="chk-sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder={t("placeholders.sender")} autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="chk-channel">{t("labels.channel")}</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger id="chk-channel" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.filter((c) => c !== "qr").map((c) => (
                        <SelectItem key={c} value={c}>{tc(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="phone" className="mt-0">
              <Label htmlFor="chk-phone" className="sr-only">{t("labels.phone")}</Label>
              <Input id="chk-phone" value={values.phone} onChange={(e) => setValue(e.target.value)} placeholder={t("placeholders.phone")} inputMode="tel" autoComplete="off" className="h-12 font-mono text-base" />
            </TabsContent>
            <TabsContent value="qr" className="mt-0 space-y-2">
              <Label htmlFor="chk-qr" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
                <ImageUp className="size-6 text-muted-foreground" aria-hidden="true" />
                <span>{t("labels.qr")}</span>
                <span className="text-xs text-muted-foreground">{t("qrHint")}</span>
                <input id="chk-qr" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onQrFile(e.target.files?.[0])} />
              </Label>
              {values.qr && (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {t("qrFound")} <DefangedText value={values.qr} />
                </p>
              )}
              {qrError && <p className="text-sm text-destructive">{t("qrNotFound")}</p>}
            </TabsContent>
          </div>
        </Tabs>

        <div className="mt-3 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Fingerprint className="size-4 shrink-0" aria-hidden="true" />
            {t("privacyNote")}
          </p>
          <Button type="submit" size="lg" disabled={pending} className="sm:min-w-36">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-4" aria-hidden="true" />}
            {pending ? t("checking") : t("submit")}
          </Button>
        </div>
      </form>

      {examples.length > 0 && !outcome && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("examples")}</span>
          {examples.map((ex) => (
            <Button
              key={ex.label}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setTab(ex.tab);
                setValues((s) => ({ ...s, [ex.tab]: ex.value }));
                if (ex.sender) setSender(ex.sender);
                submit(undefined, { tab: ex.tab, value: ex.value, sender: ex.sender });
              }}
            >
              {ex.label}
            </Button>
          ))}
        </div>
      )}

      {error && (
        <Alert variant={error === "empty" ? "default" : "destructive"} role="alert">
          <AlertDescription>{t(`states.${error === "invalid" ? "invalid" : error}`)}</AlertDescription>
        </Alert>
      )}

      <div ref={resultRef} className="scroll-mt-24">
        {pending && (
          <div className="glass-card flex flex-col items-center gap-4 rounded-2xl p-8 md:flex-row" aria-label={t("checking")}>
            <Skeleton className="size-44 rounded-full" />
            <div className="w-full space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        )}
        {!pending && outcome && (
          <div className="space-y-4">
            {report && (
              <Alert role="status">
                <AlertTitle>{t("reported")}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {t("protocol")}: <span className="font-mono font-medium">{report.protocol}</span>
                  </p>
                  <p>
                    {t("token")}: <span className="font-mono text-xs break-all">{report.trackingToken}</span>
                  </p>
                  <p className="text-xs">{t("tokenNote")}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/track?protocol=${encodeURIComponent(report.protocol)}`}>{t("track")}</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <CheckResult
              result={outcome.result}
              checkId={outcome.checkId}
              explanation={outcome.explanation.text}
              onReport={report ? undefined : onReport}
              reporting={reporting}
              onReset={reset}
            />
            {outcome.scan && (
              <>
                {baseScore !== null && outcome.result.score > baseScore && (
                  <p className="text-sm text-muted-foreground" role="status">{ti("scoreChanged", { from: baseScore, to: outcome.result.score })}</p>
                )}
                <LiveScan
                  scanId={outcome.scan.scanId}
                  token={outcome.scan.token}
                  onScore={(score) =>
                    setOutcome((o) => (o && score > o.result.score && o.result.flag !== "grey" ? { ...o, result: { ...o.result, score, flag: flagForScore(score) } } : o))
                  }
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
