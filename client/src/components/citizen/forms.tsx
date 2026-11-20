"use client";

import { Bell, Check, Download, FileDown, Plus, Share2, Trash2, Unplug } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addReportDetail, addWatchItem, deleteCheckLinks, deleteMyAccount, exportMyData, markNotificationsRead, removeWatchItem, revokeExtension,
  saveCitizenSettings, setExtensionAutoSubmit, setFollow, setSaveHistory,
} from "@/app/[locale]/citizen/_actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { GUIDES } from "@/content/learn";
import { Link, useRouter } from "@/i18n/navigation";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/server/supabase/client";

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
    <label className="glass-card flex items-start gap-3 rounded-xl p-4">
      <Switch checked={on} disabled={pending} onCheckedChange={(v) => run(() => setSaveHistory({ on: v }))} className="mt-0.5" />
      <span><span className="block font-medium">{t("saveHistory")}</span><span className="text-sm text-muted-foreground">{t("saveHistoryHint")}</span></span>
    </label>
  );
}

export function DeleteCheckButton({ id, all = false }: { id?: string; all?: boolean }) {
  const t = useTranslations("cit.checks");
  const { pending, run } = useRun();
  return all ? (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => deleteCheckLinks({ all: true }), t("deleted"))}><Trash2 className="size-4" aria-hidden="true" />{t("deleteAll")}</Button>
  ) : (
    <Button variant="ghost" size="icon" className="size-8" aria-label={t("delete")} disabled={pending} onClick={() => run(() => deleteCheckLinks({ ids: [id!] }), t("deleted"))}><Trash2 className="size-4" /></Button>
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
export function NotificationsLive({ items }: { items: { id: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }[] }) {
  const t = useTranslations("cit.alerts");
  const locale = useLocale();
  const router = useRouter();
  const { pending, run } = useRun();
  useEffect(() => {
    let client: ReturnType<typeof createBrowserClient> | null = null;
    try { client = createBrowserClient(); } catch { client = null; }
    const poll = setInterval(() => router.refresh(), 60_000);
    const ch = client?.channel("citizen-notifications").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => { toast((p.new as { title: string }).title); router.refresh(); }).subscribe();
    return () => { clearInterval(poll); if (ch) client?.removeChannel(ch); };
  }, [router]);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite"><span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-flag-green" />{t("live")} · {t("unread", { count: unread })}</p>
        {unread > 0 && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markNotificationsRead({}))}><Check className="size-4" aria-hidden="true" />{t("markAll")}</Button>}
      </div>
      {!items.length ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 rounded-xl border p-3", n.read_at ? "border-border" : "border-primary/40 bg-primary/5")}>
              <Bell className={cn("mt-0.5 size-4 shrink-0", n.read_at ? "text-muted-foreground" : "text-primary")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {n.href ? <Link href={n.href} className="font-medium hover:underline">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
                {n.body && n.body !== "watch_match" && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="text-xs text-muted-foreground">{fmtAgo(n.created_at, locale)}</p>
              </div>
              {!n.read_at && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markNotificationsRead({ ids: [n.id] }))}>{t("markRead")}</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FollowList({ institutions, followed }: { institutions: { id: string; name: string }[]; followed: string[] }) {
  const { pending, run } = useRun();
  return (
    <ul className="flex flex-wrap gap-2">
      {institutions.map((i) => {
        const on = followed.includes(i.id);
        return (
          <li key={i.id}>
            <Button size="sm" variant={on ? "default" : "outline"} aria-pressed={on} disabled={pending} onClick={() => run(() => setFollow({ institutionId: i.id, follow: !on }))}>
              {on && <Check className="size-3.5" aria-hidden="true" />}{i.name}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function WatchForm() {
  const t = useTranslations("cit.watch");
  const [kind, setKind] = useState<"phone" | "email" | "name">("phone");
  const [value, setValue] = useState("");
  const { pending, run } = useRun();
  return (
    <form className="glass-card flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => addWatchItem({ kind, value }), t("added"), () => setValue("")); }}>
      <div className="space-y-1.5"><Label htmlFor="w-kind">{t("kind")}</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}><SelectTrigger id="w-kind" className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{(["phone", "email", "name"] as const).map((k) => <SelectItem key={k} value={k}>{t(`kinds.${k}`)}</SelectItem>)}</SelectContent></Select></div>
      <div className="flex-1 space-y-1.5"><Label htmlFor="w-value">{t("value")}</Label><Input id="w-value" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" inputMode={kind === "phone" ? "tel" : kind === "email" ? "email" : "text"} /></div>
      <Button type="submit" disabled={pending || value.trim().length < 3}><Plus className="size-4" aria-hidden="true" />{t("add")}</Button>
    </form>
  );
}
export function RemoveWatchButton({ id, label }: { id: string; label: string }) {
  const tu = useTranslations("ui");
  const { pending, run } = useRun();
  return <Button size="icon" variant="ghost" className="size-8" aria-label={`${tu("remove")}: ${label}`} disabled={pending} onClick={() => run(() => removeWatchItem({ id }))}><Trash2 className="size-4" /></Button>;
}

/** C7: one-page safety card generated in the browser with @react-pdf/renderer. */
export function FamilyCard() {
  const t = useTranslations("cit.family");
  const tu = useTranslations("ui");
  const locale = useLocale() as "sq" | "en";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState<string>(GUIDES[0].slug);
  const [lang, setLang] = useState<"sq" | "en">(locale);
  const [busy, setBusy] = useState(false);
  const guide = GUIDES.find((g) => g.slug === slug)!;

  async function download() {
    setBusy(true);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");
      const { createElement: h } = await import("react");
      const msgs = (await import(`../../../messages/${lang}.json`)).default.cit.family as { cardTitle: string; cardFor: string; rules: string[]; emergency: string };
      const s = StyleSheet.create({ page: { padding: 36, fontFamily: "Helvetica", fontSize: 12, lineHeight: 1.5 }, h1: { fontSize: 24, marginBottom: 4 }, h2: { fontSize: 14, marginTop: 14, marginBottom: 4 }, box: { border: "1 solid #999", padding: 10, marginTop: 6 }, warn: { marginTop: 16, padding: 10, backgroundColor: "#fdecea" } });
      const doc = h(Document, null, h(Page, { size: "A4", style: s.page },
        h(Text, { style: s.h1 }, msgs.cardTitle),
        name ? h(Text, null, msgs.cardFor.replace("{name}", name)) : null,
        h(View, { style: s.box }, ...msgs.rules.map((r, i) => h(Text, { key: i }, `${i + 1}. ${r}`))),
        h(Text, { style: s.h2 }, guide.title[lang]),
        h(Text, null, guide.summary[lang]),
        ...guide.signs.map((x, i) => h(Text, { key: `s${i}` }, `• ${x[lang]}`)),
        h(Text, { style: s.warn }, msgs.emergency),
      ));
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mburoja-${guide.slug}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/${lang}/learn/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: guide.title[lang], url });
      else { await navigator.clipboard.writeText(url); toast.success(tu("copied")); }
    } catch { /* cancelled */ }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="glass-card space-y-4 rounded-xl p-5">
        <div className="space-y-1.5"><Label htmlFor="fc-name">{t("name")}</Label><Input id="fc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
        <div className="space-y-1.5"><Label htmlFor="fc-threat">{t("threat")}</Label>
          <Select value={slug} onValueChange={setSlug}><SelectTrigger id="fc-threat" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{GUIDES.map((g) => <SelectItem key={g.slug} value={g.slug}>{g.title[locale]}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="fc-lang">{t("language")}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "sq")}><SelectTrigger id="fc-lang" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="sq">Shqip</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} disabled={busy}><FileDown className="size-4" aria-hidden="true" />{busy ? t("preparing") : t("download")}</Button>
          <Button variant="outline" onClick={share}><Share2 className="size-4" aria-hidden="true" />{t("share")}</Button>
        </div>
      </div>
      <div className="rounded-xl border-2 border-dashed border-border bg-background p-6 text-sm" aria-label={t("cardTitle")}>
        <p className="font-display text-xl font-bold">{t("cardTitle")}</p>
        {name && <p className="text-muted-foreground">{t("cardFor", { name })}</p>}
        <ol className="mt-3 list-decimal space-y-1 pl-5">{(t.raw("rules") as string[]).map((r) => <li key={r}>{r}</li>)}</ol>
        <p className="mt-4 font-medium">{guide.title[locale]}</p>
        <ul className="list-disc pl-5 text-muted-foreground">{guide.signs.map((x) => <li key={x.en}>{x[locale]}</li>)}</ul>
        <p className="mt-4 rounded-lg bg-flag-red/10 p-2 font-medium">{t("emergency")}</p>
      </div>
    </div>
  );
}

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

export function PrivacyActions() {
  const t = useTranslations("cit.privacy");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="glass-card space-y-2 rounded-xl p-5">
        <h2 className="font-medium">{t("export")}</h2>
        <p className="text-sm text-muted-foreground">{t("exportHint")}</p>
        <Button variant="outline" disabled={pending} onClick={() => start(async () => {
          const r = await exportMyData();
          if (!r.ok) return void toast.error(tu("errorGeneric"));
          const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
          const a = document.createElement("a"); a.href = url; a.download = "mburoja-my-data.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        })}><Download className="size-4" aria-hidden="true" />{t("export")}</Button>
      </section>
      <section className="space-y-2 rounded-xl border border-destructive/40 p-5">
        <h2 className="font-medium text-destructive">{t("delete")}</h2>
        <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
        <Dialog>
          <DialogTrigger asChild><Button variant="destructive"><Trash2 className="size-4" aria-hidden="true" />{t("delete")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("delete")}</DialogTitle><DialogDescription>{t("deleteHint")}</DialogDescription></DialogHeader>
            <Label htmlFor="del-confirm">{t("deleteConfirm")}</Label>
            <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <DialogFooter>
              <Button variant="destructive" disabled={pending || confirm !== t("deleteWord")} onClick={() => start(async () => {
                const r = await deleteMyAccount({ confirm });
                if (r.ok) { toast.success(t("deleted")); router.push("/"); } else toast.error(r.message === "owner" ? tu("errorForbidden") : tu("errorGeneric"));
              })}>{tu("confirm")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}

export function CitizenSettingsForm({ name, locale, notifyEmail, notifyInApp }: { name: string; locale: "sq" | "en"; notifyEmail: boolean; notifyInApp: boolean }) {
  const t = useTranslations("cit.settings");
  const tu = useTranslations("ui");
  const [v, setV] = useState({ fullName: name, locale, notifyEmail, notifyInApp });
  const { pending, run } = useRun();
  return (
    <form className="glass-card max-w-xl space-y-4 rounded-xl p-5" onSubmit={(e) => { e.preventDefault(); run(() => saveCitizenSettings(v), t("saved")); }}>
      <div className="space-y-1.5"><Label htmlFor="cs-name">{t("name")}</Label><Input id="cs-name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoComplete="name" /></div>
      <div className="space-y-1.5"><Label htmlFor="cs-lang">{t("language")}</Label>
        <Select value={v.locale} onValueChange={(x) => setV({ ...v, locale: x as "sq" })}><SelectTrigger id="cs-lang" className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="sq">Shqip</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">{t("notifications")}</legend>
        <label className="flex items-center gap-2 text-sm"><Switch checked={v.notifyEmail} onCheckedChange={(x) => setV({ ...v, notifyEmail: x })} />{t("notifyEmail")}</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={v.notifyInApp} onCheckedChange={(x) => setV({ ...v, notifyInApp: x })} />{t("notifyInApp")}</label>
      </fieldset>
      <Button type="submit" disabled={pending}>{tu("save")}</Button>
    </form>
  );
}
