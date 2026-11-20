"use client";

import { CheckCircle2, ImageUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { submitReport } from "@/app/[locale]/(public)/report/actions";
import { CopyButton } from "@/components/shared/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { CHANNELS, REPORT_CATEGORIES } from "@/lib/schemas/analysis";
import { cn } from "@/lib/utils";

type Category = (typeof REPORT_CATEGORIES)[number];
type Channel = (typeof CHANNELS)[number];
const STEPS = ["what", "channel", "content", "contact"] as const;

function OptionGrid<T extends string>({ name, value, onChange, options, label }: { name: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{label}</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} htmlFor={`${name}-${o.value}`} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", value === o.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}>
            <RadioGroupItem id={`${name}-${o.value}`} value={o.value} />
            {o.label}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/** SPEC 7 /report: 4-step wizard. Returns protocol and a private tracking token. */
export function ReportWizard({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("report");
  const tc = useTranslations("channel");
  const tu = useTranslations("ui");
  const tk = useTranslations("check");
  const locale = useLocale() as "sq" | "en";
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category>("other");
  const [lostMoney, setLostMoney] = useState(false);
  const [channel, setChannel] = useState<Channel>("sms");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [sender, setSender] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ protocol: string; trackingToken: string } | null>(null);
  const [pending, start] = useTransition();

  function next() {
    setError(null);
    if (STEPS[step] === "content" && !text.trim() && !url.trim() && !sender.trim()) return setError(t("needContent"));
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function submit() {
    setError(null);
    if (contact.trim() && !consent) return setError(t("needConsent"));
    start(async () => {
      const res = await submitReport({
        category, channel, lostMoney, locale,
        text: text.trim() || undefined, url: url.trim() || undefined, sender: sender.trim() || undefined,
        contact: contact.trim() || undefined, contactConsent: consent || undefined,
        website: website || undefined,
      });
      if (res.ok) setDone(res.data);
      else setError(res.error === "rateLimited" ? tu("rateLimited") : res.error === "invalid" ? tu("errorInvalid") : tu("errorGeneric"));
    });
  }

  if (done) {
    return (
      <div className="glass-card space-y-5 rounded-2xl p-6 text-center md:p-8" role="status">
        <CheckCircle2 className="mx-auto size-10 text-flag-green" aria-hidden="true" />
        <h2 className="font-display text-2xl font-bold">{t("doneTitle")}</h2>
        <p className="text-muted-foreground">{t("doneBody")}</p>
        <dl className="mx-auto grid max-w-md gap-3 text-left">
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">{tk("protocol")}</dt>
            <dd className="font-mono text-lg">{done.protocol}</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">{tk("token")}</dt>
            <dd className="font-mono text-xs break-all">{done.trackingToken}</dd>
          </div>
        </dl>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <CopyButton size="sm" value={`${done.protocol}\n${done.trackingToken}`} label={t("copyBoth")} />
          <Button asChild><Link href={`/track?protocol=${encodeURIComponent(done.protocol)}`}>{t("trackNow")}</Link></Button>
          <Button variant="ghost" onClick={() => { setDone(null); setStep(0); setText(""); setUrl(""); setSender(""); setContact(""); setConsent(false); setPreview(null); }}>{t("another")}</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (step < STEPS.length - 1) next(); else submit(); }} className="glass-card space-y-6 rounded-2xl p-5 md:p-8" noValidate>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("step", { current: step + 1, total: STEPS.length })} · <span className="font-medium text-foreground">{t(`steps.${STEPS[step]}`)}</span></p>
        <Progress value={((step + 1) / STEPS.length) * 100} aria-label={t("step", { current: step + 1, total: STEPS.length })} />
      </div>

      {/* Honeypot (hidden from people and assistive tech) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {STEPS[step] === "what" && (
        <div className="space-y-5">
          <OptionGrid name="cat" label={t("categoryLabel")} value={category} onChange={setCategory} options={REPORT_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox id="lost" checked={lostMoney} onCheckedChange={(v) => setLostMoney(v === true)} />
            <div className="space-y-1">
              <Label htmlFor="lost">{t("lostMoney")}</Label>
              {lostMoney && <p className="text-sm text-destructive">{t("lostMoneyHint")}</p>}
            </div>
          </div>
        </div>
      )}

      {STEPS[step] === "channel" && (
        <OptionGrid name="ch" label={t("channelLabel")} value={channel} onChange={setChannel} options={CHANNELS.map((c) => ({ value: c, label: tc(c) }))} />
      )}

      {STEPS[step] === "content" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-text">{t("textLabel")}</Label>
            <Textarea id="r-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} aria-describedby="r-text-hint" />
            <p id="r-text-hint" className="text-xs text-muted-foreground">{t("textHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-url">{t("urlLabel")}</Label>
              <Input id="r-url" value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" inputMode="url" autoComplete="off" spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-sender">{t("senderLabel")}</Label>
              <Input id="r-sender" value={sender} onChange={(e) => setSender(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-shot" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
              <ImageUp className="size-4" aria-hidden="true" /> {t("screenshotLabel")}
              <input id="r-shot" type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
            </Label>
            <p className="text-xs text-muted-foreground">{t("screenshotHint")}</p>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded
              <img src={preview} alt={t("screenshotPreview")} className="max-h-64 rounded-lg border border-border object-contain" />
            )}
          </div>
        </div>
      )}

      {STEPS[step] === "contact" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="r-contact">{t("contactLabel")}</Label>
            <Input id="r-contact" type="email" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" aria-describedby="r-contact-hint" />
            <p id="r-contact-hint" className="text-xs text-muted-foreground">{t("contactHint")}</p>
          </div>
          {contact.trim() && (
            <div className="flex items-start gap-3">
              <Checkbox id="r-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
              <Label htmlFor="r-consent" className="font-normal">{t("contactConsent")}</Label>
            </div>
          )}
          <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium">{t("review")}</p>
            <p>{t(`categories.${category}`)} · {tc(channel)}{lostMoney ? ` · ${t("lostMoney")}` : ""}</p>
            {text && <p className="line-clamp-3 text-muted-foreground">{text}</p>}
            {url && <p className="font-mono text-xs text-muted-foreground">{url.replace(/\./g, "[.]").replace(/^http/i, "hxxp")}</p>}
          </div>
          {signedIn && <p className="text-xs text-muted-foreground">{t("signedInNote")}</p>}
        </div>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle className="sr-only">{tu("errorInvalid")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>{tu("previous")}</Button>
        <Button type="submit" disabled={pending}>
          {step < STEPS.length - 1 ? tu("next") : pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
