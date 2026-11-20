"use client";

import { ArrowLeft, ArrowRight, Briefcase, Check, CheckCircle2, CircleHelp, Gift, Globe, IdCard, ImageUp, Landmark, Mail, MessageSquare, Package, Pencil, Phone, QrCode, Receipt, Send, Share2, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { submitReport } from "@/app/[locale]/(public)/report/actions";
import { CopyButton } from "@/components/shared/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { CHANNELS, REPORT_CATEGORIES } from "@/lib/schemas/analysis";
import { cn } from "@/lib/utils";

type Category = (typeof REPORT_CATEGORIES)[number];
type Channel = (typeof CHANNELS)[number];
const STEPS = ["what", "channel", "content", "contact"] as const;

const CATEGORY_ICON: Record<Category, LucideIcon> = { fine: Receipt, bank: Landmark, parcel: Package, job: Briefcase, eAlbania: IdCard, prize: Gift, investment: TrendingUp, other: CircleHelp };
const CHANNEL_ICON: Record<Channel, LucideIcon> = { sms: MessageSquare, email: Mail, social: Share2, web: Globe, qr: QrCode, call: Phone, other: CircleHelp };

/** Radio choices shown as icon tiles. The radio stays in the accessibility tree; the tile is its label. */
function OptionGrid<T extends string>({ name, value, onChange, options, label }: { name: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; icon: LucideIcon }[]; label: string }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 font-display text-xl font-medium">{label}</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {options.map((o) => {
          const Icon = o.icon;
          const active = value === o.value;
          return (
            <label
              key={o.value}
              htmlFor={`${name}-${o.value}`}
              className={cn(
                "relative flex min-h-24 cursor-pointer flex-col items-start justify-between gap-3 rounded-xl border-2 p-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-accent/50",
              )}
            >
              <RadioGroupItem id={`${name}-${o.value}`} value={o.value} className="sr-only" />
              <span className={cn("grid size-9 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Icon className="size-[1.1rem]" aria-hidden="true" />
              </span>
              {o.label}
              {active && <Check className="absolute top-3 right-3 size-4 text-primary" aria-hidden="true" />}
            </label>
          );
        })}
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
      <Card className="py-0" role="status">
        <CardContent className="space-y-6 p-6 text-center md:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-flag-green/15">
            <CheckCircle2 className="size-8 text-flag-green" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold">{t("doneTitle")}</h2>
            <p className="text-muted-foreground">{t("doneBody")}</p>
          </div>
          <dl className="mx-auto grid max-w-lg gap-3 text-left">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <dt className="text-xs text-muted-foreground">{tk("protocol")}</dt>
              <dd className="font-mono text-2xl font-semibold tracking-wide">{done.protocol}</dd>
            </div>
            <div className="rounded-xl border-2 border-flag-orange/40 bg-flag-orange/5 p-4">
              <dt className="flex items-center gap-2 text-xs font-medium text-foreground">
                <TriangleAlert className="size-4 text-flag-orange" aria-hidden="true" />
                {tk("token")}
              </dt>
              <dd className="mt-1 font-mono text-sm break-all">{done.trackingToken}</dd>
              <p className="mt-2 text-xs text-muted-foreground">{t("tokenWarning")}</p>
            </div>
          </dl>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <CopyButton size="sm" value={`${done.protocol}\n${done.trackingToken}`} label={t("copyBoth")} />
            <Button asChild className="rounded-full"><Link href={`/track?protocol=${encodeURIComponent(done.protocol)}`}>{t("trackNow")}</Link></Button>
            <Button variant="ghost" onClick={() => { setDone(null); setStep(0); setText(""); setUrl(""); setSender(""); setContact(""); setConsent(false); setPreview(null); }}>{t("another")}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (step < STEPS.length - 1) next(); else submit(); }} className="glass-card relative space-y-6 overflow-hidden rounded-2xl p-5 md:p-8" noValidate>
      <nav aria-label={t("step", { current: step + 1, total: STEPS.length })} className="-mx-5 -mt-5 border-b border-border px-5 py-4 md:-mx-8 md:-mt-8 md:px-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((k, i) => {
            const state = i < step ? "done" : i === step ? "current" : "todo";
            return (
              <li key={k} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={state === "current" ? "step" : undefined}>
                <button
                  type="button"
                  disabled={i > step}
                  onClick={() => setStep(i)}
                  className="flex items-center gap-2 rounded-full text-sm disabled:cursor-default"
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-colors",
                      state === "done" && "border-primary bg-primary text-primary-foreground",
                      state === "current" && "border-primary text-primary ring-4 ring-primary/15",
                      state === "todo" && "border-border text-muted-foreground",
                    )}
                  >
                    {state === "done" ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className={cn("hidden font-medium sm:inline", state === "todo" && "text-muted-foreground")}>{t(`steps.${k}`)}</span>
                </button>
                {i < STEPS.length - 1 && <span aria-hidden="true" className={cn("h-0.5 flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground sm:hidden">{t(`steps.${STEPS[step]}`)}</p>
      </nav>

      {/* Honeypot (hidden from people and assistive tech) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {STEPS[step] === "what" && (
        <div className="space-y-5">
          <OptionGrid name="cat" label={t("categoryLabel")} value={category} onChange={setCategory} options={REPORT_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`), icon: CATEGORY_ICON[c] }))} />
          <div className={cn("flex items-start gap-3 rounded-xl border-2 p-4 transition-colors", lostMoney ? "border-flag-orange/50 bg-flag-orange/10" : "border-border")}>
            <Checkbox id="lost" checked={lostMoney} onCheckedChange={(v) => setLostMoney(v === true)} className="mt-0.5" />
            <div className="space-y-1">
              <Label htmlFor="lost" className="text-base">{t("lostMoney")}</Label>
              {lostMoney && (
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TriangleAlert className="size-4 shrink-0 text-flag-orange" aria-hidden="true" />
                  {t("lostMoneyHint")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {STEPS[step] === "channel" && (
        <OptionGrid name="ch" label={t("channelLabel")} value={channel} onChange={setChannel} options={CHANNELS.map((c) => ({ value: c, label: tc(c), icon: CHANNEL_ICON[c] }))} />
      )}

      {STEPS[step] === "content" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-text">{t("textLabel")}</Label>
            <Textarea id="r-text" value={text} onChange={(e) => setText(e.target.value)} rows={7} className="min-h-44 rounded-xl px-4 py-3 text-base" aria-describedby="r-text-hint" />
            <p id="r-text-hint" className="text-xs text-muted-foreground">{t("textHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-url">{t("urlLabel")}</Label>
              <Input id="r-url" value={url} onChange={(e) => setUrl(e.target.value)} className="h-11 rounded-xl font-mono" inputMode="url" autoComplete="off" spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-sender">{t("senderLabel")}</Label>
              <Input id="r-sender" value={sender} onChange={(e) => setSender(e.target.value)} className="h-11 rounded-xl" autoComplete="off" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-shot" className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-6 text-center text-sm hover:border-primary/50 hover:bg-accent/50 focus-within:ring-2 focus-within:ring-ring">
              <ImageUp className="size-6 text-primary" aria-hidden="true" /> {t("screenshotLabel")}
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
            <Input id="r-contact" type="email" value={contact} onChange={(e) => setContact(e.target.value)} className="h-11 rounded-xl" autoComplete="email" aria-describedby="r-contact-hint" />
            <p id="r-contact-hint" className="text-xs text-muted-foreground">{t("contactHint")}</p>
          </div>
          {contact.trim() && (
            <div className="flex items-start gap-3">
              <Checkbox id="r-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
              <Label htmlFor="r-consent" className="font-normal">{t("contactConsent")}</Label>
            </div>
          )}
          <section aria-labelledby="review-title" className="space-y-3">
            <h3 id="review-title" className="font-display text-lg font-medium">{t("review")}</h3>
            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              {[
                { k: t("summaryCategory"), v: `${t(`categories.${category}`)}${lostMoney ? ` · ${t("lostMoney")}` : ""}`, to: 0 },
                { k: t("summaryChannel"), v: tc(channel), to: 1 },
                { k: t("summaryContent"), v: [text && text.slice(0, 160) + (text.length > 160 ? "…" : ""), url && url.replace(/\./g, "[.]").replace(/^http/i, "hxxp"), sender].filter(Boolean).join(" · "), to: 2 },
                { k: t("summaryContact"), v: contact.trim() || t("noContact"), to: 3 },
              ].map((row) => (
                <div key={row.k} className="flex items-start gap-4 p-3">
                  <dt className="w-24 shrink-0 text-muted-foreground">{row.k}</dt>
                  <dd className="min-w-0 flex-1 break-words">{row.v}</dd>
                  {row.to < 3 && (
                    <Button type="button" variant="ghost" size="sm" className="-my-1 h-7 px-2" onClick={() => setStep(row.to)}>
                      <Pencil className="size-3.5" aria-hidden="true" />
                      {t("edit")}
                    </Button>
                  )}
                </div>
              ))}
            </dl>
          </section>
          {signedIn && <p className="text-xs text-muted-foreground">{t("signedInNote")}</p>}
        </div>
      )}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle className="sr-only">{tu("errorInvalid")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className={cn(step === 0 && "invisible")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {tu("previous")}
        </Button>
        <Button type="submit" size="lg" disabled={pending} className="rounded-full px-6">
          {step < STEPS.length - 1 ? (
            <>{tu("next")}<ArrowRight className="size-4" aria-hidden="true" /></>
          ) : (
            <><Send className="size-4" aria-hidden="true" />{pending ? t("submitting") : t("submit")}</>
          )}
        </Button>
      </div>
    </form>
  );
}
