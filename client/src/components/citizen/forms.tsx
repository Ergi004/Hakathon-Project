"use client";

import { AtSign, Download, History, Phone, UserRound, Plus, Trash2, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addReportDetail, addWatchItem, deleteCheckLinks, deleteMyAccount, exportMyData, removeWatchItem, revokeExtension,
  saveCitizenSettings, setExtensionAutoSubmit, setSaveHistory,
} from "@/app/[locale]/citizen/_actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type R = { ok: boolean; error?: string; message?: string };
function useRun() {
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  return { pending, run: (fn: () => Promise<R>, ok?: string, after?: (r: R) => void) => start(async () => { const r = await fn(); if (r.ok) { if (ok) toast.success(ok); after?.(r); router.refresh(); } else toast.error(r.error === "forbidden" ? tu("errorForbidden") : tu("errorGeneric")); }) };
}

export function SaveHistoryToggle({ on }: { on: boolean }) {
  const t = useTranslations("cit.checks");
  const { pending, run } = useRun();
  return (
    <label htmlFor="save-history" className={cn("flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors", on ? "border-border bg-card" : "border-flag-yellow/40 bg-flag-yellow/5")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-primary/12 text-primary" : "bg-flag-yellow/15 text-flag-yellow")}>
        <History className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{t("saveHistory")}</span>
        <span className="block text-sm text-muted-foreground">{on ? t("saveHistoryHint") : t("historyOff")}</span>
      </span>
      <Switch id="save-history" checked={on} disabled={pending} onCheckedChange={(v) => run(() => setSaveHistory({ on: v }))} />
    </label>
  );
}

export function DeleteCheckButton({ id, all = false, count = 0 }: { id?: string; all?: boolean; count?: number }) {
  const t = useTranslations("cit.checks");
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  if (!all) {
    return <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={t("delete")} disabled={pending} onClick={() => run(() => deleteCheckLinks({ ids: [id!] }), t("deleted"))}><Trash2 className="size-4" aria-hidden="true" /></Button>;
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full"><Trash2 className="size-4" aria-hidden="true" />{t("deleteAll")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("confirmTitle")}</DialogTitle>
          <DialogDescription>{t("confirmBody", { count })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteCheckLinks({ all: true }), t("deleted"), () => setOpen(false))}>
            <Trash2 className="size-4" aria-hidden="true" />{t("deleteAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDetailForm({ id }: { id: string }) {
  const t = useTranslations("cit.reports");
  const [body, setBody] = useState("");
  const { pending, run } = useRun();
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => addReportDetail({ id, body }), t("detailSaved"), () => setBody("")); }}>
      <Label htmlFor={`rd-${id}`}>{t("addDetail")}</Label>
      <Textarea id={`rd-${id}`} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("detailPlaceholder")} />
      <Button size="sm" type="submit" disabled={pending || body.trim().length < 3}>{t("addDetail")}</Button>
    </form>
  );
}

/** C4: notifications with Realtime (RLS: own rows only) and a 60 s polling fallback. */
const WATCH_KINDS = [
  { k: "phone", Icon: Phone },
  { k: "email", Icon: AtSign },
  { k: "name", Icon: UserRound },
] as const;

export function WatchForm() {
  const t = useTranslations("cit.watch");
  const [kind, setKind] = useState<"phone" | "email" | "name">("phone");
  const [value, setValue] = useState("");
  const { pending, run } = useRun();
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => addWatchItem({ kind, value }), t("added"), () => setValue("")); }}>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t("kind")}</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {WATCH_KINDS.map(({ k, Icon }) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                kind === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(`kinds.${k}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="w-value" className="sr-only">{t("value")}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="w-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t(`placeholders.${kind}`)}
            autoComplete="off"
            inputMode={kind === "phone" ? "tel" : kind === "email" ? "email" : "text"}
            className="h-12 flex-1 rounded-xl text-base"
            aria-describedby="w-hint"
          />
          <Button type="submit" size="lg" className="h-12 rounded-xl px-6" disabled={pending || value.trim().length < 3}>
            <Plus className="size-4" aria-hidden="true" />{t("add")}
          </Button>
        </div>
        <p id="w-hint" className="text-xs text-muted-foreground">{t("addHint")}</p>
      </div>
    </form>
  );
}

export function RemoveWatchButton({ id, label }: { id: string; label: string }) {
  const tu = useTranslations("ui");
  const { pending, run } = useRun();
  return <Button size="icon" variant="ghost" className="size-8" aria-label={`${tu("remove")}: ${label}`} disabled={pending} onClick={() => run(() => removeWatchItem({ id }))}><Trash2 className="size-4" /></Button>;
}

/** C7: one-page safety card generated in the browser with @react-pdf/renderer. */
export function ExtensionControls({ id, autoSubmit }: { id: string; autoSubmit: boolean }) {
  const t = useTranslations("cit.extension");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <label className="inline-flex items-center gap-2 text-sm"><Switch checked={autoSubmit} disabled={pending} onCheckedChange={(v) => run(() => setExtensionAutoSubmit({ id, on: v }))} />{t("autoSubmit")}</label>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => revokeExtension({ id }), t("revoked"))}><Unplug className="size-4" aria-hidden="true" />{t("revoke")}</Button>
    </div>
  );
}

export function ExportDataButton() {
  const t = useTranslations("cit.privacy");
  const tu = useTranslations("ui");
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" className="rounded-full" disabled={pending} onClick={() => start(async () => {
      const r = await exportMyData();
      if (!r.ok) return void toast.error(tu("errorGeneric"));
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "mburoja-my-data.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    })}><Download className="size-4" aria-hidden="true" />{t("export")}</Button>
  );
}

export function DeleteAccountButton() {
  const t = useTranslations("cit.privacy");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="destructive" className="rounded-full"><Trash2 className="size-4" aria-hidden="true" />{t("delete")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("delete")}</DialogTitle><DialogDescription>{t("deleteHint")}</DialogDescription></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="del-confirm">{t("deleteConfirm")}</Label>
          <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="font-mono" />
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={pending || confirm !== t("deleteWord")} onClick={() => start(async () => {
            const r = await deleteMyAccount({ confirm });
            if (r.ok) { toast.success(t("deleted")); router.push("/"); } else toast.error(r.message === "owner" ? tu("errorForbidden") : tu("errorGeneric"));
          })}>{tu("confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CitizenSettingsForm({ name, locale, notifyEmail, notifyInApp, account }: { name: string; locale: "sq" | "en"; notifyEmail: boolean; notifyInApp: boolean; account: React.ReactNode }) {
  const t = useTranslations("cit.settings");
  const tu = useTranslations("ui");
  const initial = { fullName: name, locale, notifyEmail, notifyInApp };
  const [v, setV] = useState(initial);
  const { pending, run } = useRun();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const row = (title: string, hint: string, body: React.ReactNode) => (
    <section className="grid gap-4 py-6 first:pt-0 md:grid-cols-[18rem_1fr] lg:grid-cols-[22rem_1fr] md:gap-10">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="min-w-0">{body}</div>
    </section>
  );
  const toggle = (id: string, label: string, hint: string, checked: boolean, on: (x: boolean) => void) => (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-4 p-4">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <Switch id={id} checked={checked} onCheckedChange={on} />
    </label>
  );
  return (
    <form className="divide-y divide-border" onSubmit={(e) => { e.preventDefault(); run(() => saveCitizenSettings(v), t("saved")); }}>
      {row(t("profile"), t("profileHint"), (
        <div className="max-w-2xl space-y-1.5">
          <Label htmlFor="cs-name">{t("name")}</Label>
          <Input id="cs-name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoComplete="name" className="h-11 rounded-xl" />
        </div>
      ))}
      {row(t("prefs"), t("prefsHint"), (
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-medium">{t("language")}</legend>
          <div role="radiogroup" className="inline-flex rounded-xl border border-border p-1">
            {(["sq", "en"] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={v.locale === l} onClick={() => setV({ ...v, locale: l })}
                className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", v.locale === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {l === "sq" ? "Shqip" : "English"}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {row(t("notifications"), t("notificationsHint"), (
        <div className="max-w-3xl divide-y divide-border rounded-xl border border-border">
          {toggle("cs-email", t("notifyEmail"), t("notifyEmailHint"), v.notifyEmail, (x) => setV({ ...v, notifyEmail: x }))}
          {toggle("cs-inapp", t("notifyInApp"), t("notifyInAppHint"), v.notifyInApp, (x) => setV({ ...v, notifyInApp: x }))}
        </div>
      ))}
      {row(t("account"), t("accountHint"), account)}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 bg-background/90 px-1 py-4 backdrop-blur">
        {dirty && <p className="text-sm text-muted-foreground" aria-live="polite">{t("unsaved")}</p>}
        <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => setV(initial)}>{tu("cancel")}</Button>
        <Button type="submit" className="rounded-full px-6" disabled={!dirty || pending}>{tu("save")}</Button>
      </div>
    </form>
  );
}
