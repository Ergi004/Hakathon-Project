"use client";

import jsQR from "jsqr";
import { Fingerprint, ImageUp, Info, Link2, Loader2, MessageSquareText, Phone, QrCode, ScanSearch, ScanText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { reportFromCheck, checkAction, checkImageAction, type ImageCheckError } from "@/app/[locale]/(public)/check/actions";
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
import { flagForScore, isReportable } from "@/lib/flags";
import { cn } from "@/lib/utils";
import type { CheckOutcome } from "@/server/checks";
import { LiveScan } from "@/components/intel/live-scan";
import { CheckResult } from "./check-result";
import { ScanDetails } from "./scan-details";
import { ScreenshotInput, type PreparedShot } from "./screenshot-input";

type Tab = "link" | "message" | "image" | "phone" | "qr";
export interface CheckExample {
  label: string;
  tab: Exclude<Tab, "image">;
  value: string;
  sender?: string;
}

/** Message first: it takes a whole email or SMS, and also recognises a bare link or number. */
const TAB_ICON = { message: MessageSquareText, image: ScanText, link: Link2, phone: Phone, qr: QrCode } as const;

/** Glowing command-bar checker (SPEC 3, 7). Used on / and /check. */
export function CheckBox({ examples = [], hero = false }: { examples?: CheckExample[]; hero?: boolean }) {
  const t = useTranslations("check");
  const tc = useTranslations("channel");
  const ti = useTranslations("intel");
  const locale = useLocale() as "sq" | "en";
  const [tab, setTab] = useState<Tab>("message");
  const [values, setValues] = useState<Record<Tab, string>>({ link: "", message: "", image: "", phone: "", qr: "" });
  const [shot, setShot] = useState<PreparedShot | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [sender, setSender] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number] | "auto">("auto");
  const [qrError, setQrError] = useState(false);
  const [error, setError] = useState<ImageCheckError | "empty" | "noImage" | "notReportable" | null>(null);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [report, setReport] = useState<{ protocol: string; trackingToken: string } | null>(null);
  const [baseScore, setBaseScore] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [reporting, startReporting] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  const value = values[tab];
  const setValue = (v: string) => setValues((s) => ({ ...s, [tab]: v }));

  function submitImage() {
    if (!shot) {
      setError("noImage");
      return;
    }
    setError(null);
    setReport(null);
    startTransition(async () => {
      const res = await checkImageAction({ image: shot.dataUrl, qrUrls: shot.qrUrls, locale });
      if (res.ok) {
        setOutcome(res.data);
        setBaseScore(res.data.result.score);
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } else setError(res.error);
    });
  }

  /** Recognition can misread: move the transcript into the message box so the citizen can fix it. */
  function editTranscript() {
    const s = outcome?.detected.screenshot;
    if (!s) return;
    const asEmail = outcome?.detected.kind === "email";
    // Rebuild the header lines for an email so the message box reads them again.
    const text = asEmail ? [s.sender && `From: ${s.sender}`, s.subject && `Subject: ${s.subject}`, "", s.body].filter((x) => x !== null).join("\n") : s.body;
    setValues((v) => ({ ...v, message: text }));
    if (!asEmail && s.sender) setSender(s.sender);
    setTab("message");
    setOutcome(null);
    setReport(null);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function submit(e?: React.FormEvent, override?: { tab: Exclude<Tab, "image">; value: string; sender?: string }) {
    e?.preventDefault();
    if (!override && tab === "image") return submitImage();
    const activeTab = override?.tab ?? (tab as Exclude<Tab, "image">);
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
        channel: activeTab === "message" && channel !== "auto" ? channel : undefined,
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
      const textChannel = channel !== "auto" ? channel : outcome?.detected.kind === "email" ? "email" : "sms";
      const s = outcome?.detected.screenshot;
      const res = await reportFromCheck(
        tab === "image" && s
          ? {
              // A screenshot is reported as what recognition read from it; the image itself is never sent on.
              category: "other",
              channel: s.messageKind === "qr_only" ? "qr" : outcome?.detected.kind === "email" ? "email" : "sms",
              text: s.body || undefined,
              url: s.qrLinks[0],
              sender: s.sender ?? undefined,
              checkId: outcome?.checkId ?? undefined,
              locale,
            }
          : {
        category: "other",
        channel: tab === "qr" ? "qr" : tab === "phone" ? "call" : isText ? textChannel : "web",
        text: isText ? value : undefined,
        url: tab === "link" || tab === "qr" ? value : undefined,
        sender: tab === "phone" ? value : isText ? sender || undefined : undefined,
        checkId: outcome?.checkId ?? undefined,
        locale,
            },
      );
      if (res.ok) setReport(res.data);
      else setError(res.error === "rateLimited" ? "rateLimited" : res.error === "notReportable" ? "notReportable" : "error");
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
    setValues({ link: "", message: "", image: "", phone: "", qr: "" });
    setShot(null);
    setSender("");
  }

  return (
    <div className="space-y-6">
      <form
        ref={formRef}
        onSubmit={submit}
        className={cn(
          "glass-card relative rounded-3xl p-4 md:p-6",
          hero && "shadow-[0_0_80px_-20px_var(--glow)] ring-1 ring-primary/20",
        )}
        aria-busy={pending}
      >
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setError(null); }}>
          <p id="chk-ask" className="mb-1 font-display text-base font-medium md:text-lg">{t("askTitle")}</p>
          <TabsList aria-labelledby="chk-ask" className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-5">
            {(Object.keys(TAB_ICON) as Tab[]).map((k) => {
              const Icon = TAB_ICON[k];
              return (
                <TabsTrigger
                  key={k}
                  value={k}
                  className="h-full flex-col items-start justify-start gap-1 rounded-xl border-border bg-background/60 px-3.5 py-3 text-left whitespace-normal text-muted-foreground data-active:border-primary data-active:bg-primary/10 data-active:text-foreground dark:border-border dark:data-active:border-primary dark:data-active:bg-primary/10"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground md:text-base">
                    <Icon className="size-4 text-primary md:size-5" aria-hidden="true" />
                    {t(`tabs.${k}`)}
                  </span>
                  <span className="hidden text-xs leading-snug font-normal sm:line-clamp-2">{t(`tabHints.${k}`)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <p className="mt-3 flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {t(`howTo.${tab}`)}
          </p>

          <div className="mt-3 space-y-3">
            <TabsContent value="image" className="mt-0 space-y-2">
              <ScreenshotInput value={shot} onChange={(v) => { setShot(v); setError(null); }} active={tab === "image"} />
              <p className="flex gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t("image.note")}</p>
            </TabsContent>
            <TabsContent value="link" className="mt-0 space-y-1.5">
              <Label htmlFor="chk-link" className="sr-only">{t("labels.link")}</Label>
              <Input id="chk-link" value={values.link} onChange={(e) => setValue(e.target.value)} placeholder={t("placeholders.link")} inputMode="url" autoComplete="off" spellCheck={false} className="h-14 rounded-xl px-4 font-mono text-base md:text-lg" />
            </TabsContent>
            <TabsContent value="message" className="mt-0 space-y-3">
              <Label htmlFor="chk-msg" className="sr-only">{t("labels.message")}</Label>
              <Textarea id="chk-msg" value={values.message} onChange={(e) => setValue(e.target.value)} placeholder={t("placeholders.message")} rows={7} className="min-h-44 rounded-xl px-4 py-3 text-base md:text-lg" />
              <details className="group rounded-xl border border-border bg-background/40 px-3 py-2 [&[open]]:pb-3">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">{t("moreDetails")}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="chk-sender">{t("labels.sender")}</Label>
                  <Input id="chk-sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder={t("placeholders.sender")} autoComplete="off" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="chk-channel">{t("labels.channel")}</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger id="chk-channel" className="h-11 w-full rounded-xl data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("channelAuto")}</SelectItem>
                      {CHANNELS.filter((c) => c !== "qr").map((c) => (
                        <SelectItem key={c} value={c}>{tc(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              </details>
            </TabsContent>
            <TabsContent value="phone" className="mt-0">
              <Label htmlFor="chk-phone" className="sr-only">{t("labels.phone")}</Label>
              <Input id="chk-phone" value={values.phone} onChange={(e) => setValue(e.target.value)} placeholder={t("placeholders.phone")} inputMode="tel" autoComplete="off" className="h-14 rounded-xl px-4 font-mono text-base md:text-lg" />
            </TabsContent>
            <TabsContent value="qr" className="mt-0 space-y-2">
              <Label htmlFor="chk-qr" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center text-base hover:border-primary/50 hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
                <ImageUp className="size-8 text-primary" aria-hidden="true" />
                <span className="font-medium">{t("labels.qr")}</span>
                <span className="text-sm text-muted-foreground">{t("qrHint")}</span>
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

        <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Fingerprint className="size-4 shrink-0" aria-hidden="true" />
            {t("privacyNote")}
          </p>
          <Button type="submit" size="lg" disabled={pending} className="h-12 rounded-xl text-base sm:min-w-44">
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-5" aria-hidden="true" />}
            {pending ? (tab === "image" ? t("image.reading") : t("checking")) : t("submit")}
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
          <AlertDescription>{error === "notReportable" ? t("notReportable") : error === "noImage" || error === "unreadable" || error === "unavailable" ? t(`image.${error}`) : t(`states.${error === "invalid" ? "invalid" : error}`)}</AlertDescription>
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
              onReport={report || !isReportable(outcome.result.flag) ? undefined : onReport}
              reportNote={!report && !isReportable(outcome.result.flag) && outcome.result.flag !== "grey" ? t(outcome.result.flag === "green" ? "noReportGreen" : "noReportYellow") : undefined}
              reporting={reporting}
              onReset={reset}
            >
              <ScanDetails outcome={outcome} onEditTranscript={outcome.detected.screenshot ? editTranscript : undefined} />
            </CheckResult>
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
