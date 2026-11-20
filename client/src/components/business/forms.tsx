"use client";

import { BadgeCheck, CheckCircle2, Download, KeyRound, Play, Plus, Send, ShieldCheck, Square, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addBrandAsset, allowlistOwnDomain, createApiKey, createSimulation, escalateBrandAlert, finishSimulation, generateComplianceExport, getVerificationToken, inviteMember, launchSimulation,
  removeBrandAsset, removeMember, requestDomainTakedown, revokeApiKey, saveOrgSettings, setMemberRole, updateBrandAlert, verifyBrandDomain,
} from "@/app/[locale]/business/_actions";
import { CopyButton } from "@/components/shared/copy-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";

type R = { ok: boolean; error?: string; message?: string };
function useRun() {
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<R>, ok?: string | ((r: R) => string), after?: (r: R) => void) =>
      start(async () => {
        const r = await fn();
        if (r.ok) { if (ok) toast.success(typeof ok === "function" ? ok(r) : ok); after?.(r); router.refresh(); }
        else toast.error(r.error === "forbidden" ? tu("errorForbidden") : r.error === "invalid" ? tu("errorInvalid") : tu("errorGeneric"));
      }),
  };
}

/* ---------------- B2 brand setup ---------------- */
const KINDS = ["domain", "brand_name", "sms_sender", "phone", "social"] as const;
type Asset = { id: string; kind: string; value: string; verified_at: string | null };

function VerifyDialog({ asset }: { asset: Asset }) {
  const t = useTranslations("biz.onboarding");
  const [token, setToken] = useState<string | null>(null);
  const { pending, run } = useRun();
  return (
    <Dialog onOpenChange={(o) => o && !token && getVerificationToken({ domain: asset.value }).then((r) => r.ok && setToken(r.data.token))}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><ShieldCheck className="size-4" aria-hidden="true" />{t("verify")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("verifyTitle", { domain: asset.value })}</DialogTitle><DialogDescription>{t("verifyNote")}</DialogDescription></DialogHeader>
        {token && (
          <div className="space-y-3 text-sm">
            <p>{t("verifyDns")}</p>
            <div className="flex items-center gap-2 rounded bg-muted p-2"><code className="flex-1 font-mono text-xs break-all">{token}</code><CopyButton value={token} /></div>
            <p>{t("verifyFile", { domain: asset.value })}</p>
            <Button disabled={pending} onClick={() => run(() => verifyBrandDomain({ id: asset.id }), t("verifyOk"))}>{t("verifyNow")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AssetManager({ assets, canEdit }: { assets: Asset[]; canEdit: boolean }) {
  const t = useTranslations("biz.onboarding");
  const tu = useTranslations("ui");
  const [values, setValues] = useState<Record<string, string>>({});
  const { pending, run } = useRun();
  return (
    <ol className="space-y-4">
      {KINDS.map((k, i) => {
        const list = assets.filter((a) => a.kind === k);
        return (
          <li key={k} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium"><span className="mr-2 text-xs text-muted-foreground">{t("step", { n: i + 1 })}</span>{t(`kinds.${k}`)}</h2>
              {list.length > 0 && <Badge variant="secondary"><CheckCircle2 className="size-3" aria-hidden="true" />{t("done")}</Badge>}
            </div>
            <ul className="space-y-1.5">
              {list.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
                  <span className="font-mono">{a.value}</span>
                  {k === "domain" && (a.verified_at ? <Badge><BadgeCheck className="size-3" aria-hidden="true" />{t("verified")}</Badge> : <Badge variant="outline">{t("unverified")}</Badge>)}
                  <span className="ml-auto flex gap-1">
                    {k === "domain" && !a.verified_at && canEdit && <VerifyDialog asset={a} />}
                    {canEdit && <Button size="icon" variant="ghost" className="size-8" aria-label={`${tu("remove")} ${a.value}`} disabled={pending} onClick={() => run(() => removeBrandAsset({ id: a.id }))}><Trash2 className="size-4" /></Button>}
                  </span>
                </li>
              ))}
            </ul>
            {canEdit && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addBrandAsset({ kind: k, value: values[k] ?? "" }), tu("saved"), () => setValues({ ...values, [k]: "" })); }}>
                <Label htmlFor={`asset-${k}`} className="sr-only">{t(`kinds.${k}`)}</Label>
                <Input id={`asset-${k}`} value={values[k] ?? ""} onChange={(e) => setValues({ ...values, [k]: e.target.value })} placeholder={t(`placeholders.${k}`)} className={k === "domain" ? "font-mono" : undefined} />
                <Button type="submit" variant="outline" disabled={pending || !(values[k] ?? "").trim()}><Plus className="size-4" aria-hidden="true" />{t("add")}</Button>
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- B3 alerts ---------------- */
export function AlertActions({ id, status, canAct }: { id: string; status: string; canAct: boolean }) {
  const t = useTranslations("biz.alerts");
  const { pending, run } = useRun();
  if (!canAct || status === "resolved") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "new" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => updateBrandAlert({ id, status: "acknowledged" }), t("statuses.acknowledged"))}>{t("acknowledge")}</Button>}
      {status !== "escalated" && <Button size="sm" disabled={pending} onClick={() => run(() => escalateBrandAlert({ id }), (r) => t("escalated", { protocol: (r as R & { data: { protocol: string } }).data.protocol }))}><Send className="size-4" aria-hidden="true" />{t("escalate")}</Button>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => updateBrandAlert({ id, status: "resolved" }), t("statuses.resolved"))}>{t("resolve")}</Button>
    </div>
  );
}

/* ---------------- B5 domains ---------------- */
export function DomainActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("biz.domains");
  const td = useTranslations("soc.domains");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-1">
      {status !== "allowlisted" && <Button size="sm" variant="ghost" disabled={pending} title={t("allowlistHint")} onClick={() => run(() => allowlistOwnDomain({ id }), td("statuses.allowlisted"))}>{td("allowlist")}</Button>}
      {!["taken_down", "allowlisted"].includes(status) && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => requestDomainTakedown({ id }), (r) => t("requested", { protocol: (r as R & { data: { protocol: string } }).data.protocol }))}>{t("requestTakedown")}</Button>}
    </div>
  );
}

/* ---------------- B7 customer notices ---------------- */
type Camp = { id: string; code: string; tactic: string; domains: string[] };
const NOTICE = {
  sq: {
    sms: (b: string, d: string) => `${b}: Kujdes! Po qarkullojnë mesazhe të rreme në emrin tonë që ju çojnë te ${d}. Ne nuk ju kërkojmë kurrë kode ose të dhëna karte me SMS. Mos klikoni.`,
    email: (b: string, d: string, tac: string) => `Subjekti: Kujdes nga mesazhet e rreme në emër të ${b}\n\nI nderuar klient,\n\nKemi vënë re mesazhe të rreme (${tac}) që pretendojnë se vijnë nga ${b} dhe ju dërgojnë te adresa ${d}.\n\n${b} nuk ju kërkon kurrë kode OTP, fjalëkalime ose të dhëna karte me email ose SMS.\n\nNëse keni klikuar ose keni dhënë të dhëna, na kontaktoni menjëherë në numrin zyrtar.\n\nMe respekt,\nEkipi i ${b}`,
    banner: (b: string, d: string) => `⚠ Kujdes: mesazhe të rreme në emër të ${b} ju çojnë te ${d}. Nuk ju kërkojmë kurrë kode me SMS.`,
  },
  en: {
    sms: (b: string, d: string) => `${b}: Warning! Fake messages in our name are sending people to ${d}. We never ask for codes or card details by SMS. Do not click.`,
    email: (b: string, d: string, tac: string) => `Subject: Beware of fake messages in the name of ${b}\n\nDear customer,\n\nWe have seen fake messages (${tac}) claiming to come from ${b} and sending you to ${d}.\n\n${b} never asks for OTP codes, passwords or card details by email or SMS.\n\nIf you clicked or shared details, contact us right away on our official number.\n\nKind regards,\nThe ${b} team`,
    banner: (b: string, d: string) => `⚠ Warning: fake messages in the name of ${b} send you to ${d}. We never ask for codes by SMS.`,
  },
} as const;

export function NoticeComposer({ brand, campaigns }: { brand: string; campaigns: Camp[] }) {
  const t = useTranslations("biz.notices");
  const [cid, setCid] = useState(campaigns[0]?.id ?? "");
  const [channel, setChannel] = useState<"sms" | "email" | "banner">("sms");
  const c = campaigns.find((x) => x.id === cid);
  const domain = (c?.domains[0] ?? "—").replace(/\./g, "[.]");
  const tactic = c?.tactic.replace(/_/g, " ") ?? "";
  const texts = useMemo(() => ({ sq: channel === "email" ? NOTICE.sq.email(brand, domain, tactic) : NOTICE.sq[channel](brand, domain), en: channel === "email" ? NOTICE.en.email(brand, domain, tactic) : NOTICE.en[channel](brand, domain) }), [brand, domain, tactic, channel]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const key = (l: "sq" | "en") => `${cid}:${channel}:${l}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="space-y-1.5"><Label htmlFor="cn-c">{t("campaign")}</Label>
          <Select value={cid} onValueChange={setCid}><SelectTrigger id="cn-c" className="w-full sm:w-72"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{campaigns.map((x) => <SelectItem key={x.id} value={x.id}>{x.code} · {x.tactic.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="cn-ch">{t("channel")}</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}><SelectTrigger id="cn-ch" className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{(["sms", "email", "banner"] as const).map((x) => <SelectItem key={x} value={x}>{t(`channels.${x}`)}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(["sq", "en"] as const).map((l) => {
          const value = edited[key(l)] ?? texts[l];
          return (
            <div key={l} className="glass-card space-y-2 rounded-xl p-4" lang={l}>
              <div className="flex items-center justify-between"><Label htmlFor={`cn-${l}`}>{t("preview")} · {l.toUpperCase()}</Label><span className="text-xs text-muted-foreground">{t("chars", { count: value.length })}</span></div>
              <Textarea id={`cn-${l}`} value={value} onChange={(e) => setEdited({ ...edited, [key(l)]: e.target.value })} rows={channel === "email" ? 14 : 5} />
              <CopyButton size="sm" value={value} label={t("copy")} />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("out")}</p>
    </div>
  );
}

/* ---------------- B8 training ---------------- */
type Sim = { id: string; name: string; template_key: string; status: string; sent: number; opened: number; clicked: number; reported: number; created_at: string };
export function SimulationManager({ sims, canEdit }: { sims: Sim[]; canEdit: boolean }) {
  const t = useTranslations("biz.training");
  const tu = useTranslations("ui");
  const [name, setName] = useState("");
  const [tpl, setTpl] = useState("parcel");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const { pending, run } = useRun();
  return (
    <div className="space-y-5">
      <Alert><AlertDescription>{t("simulated")}</AlertDescription></Alert>
      {canEdit && (
        <form className="glass-card flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => createSimulation({ name, templateKey: tpl }), tu("saved"), () => setName("")); }}>
          <div className="flex-1 space-y-1.5"><Label htmlFor="sim-name">{t("name")}</Label><Input id="sim-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sim-tpl">{t("template")}</Label>
            <Select value={tpl} onValueChange={setTpl}><SelectTrigger id="sim-tpl" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>{(["parcel", "it_password", "invoice", "bonus"] as const).map((k) => <SelectItem key={k} value={k}>{t(`templates.${k}`)}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" disabled={pending || name.trim().length < 2}><Plus className="size-4" aria-hidden="true" />{t("new")}</Button>
        </form>
      )}
      {!sims.length ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : sims.map((s) => {
        const steps = [["sent", s.sent], ["opened", s.opened], ["clicked", s.clicked], ["reported", s.reported]] as const;
        return (
          <section key={s.id} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{s.name}</h2><Badge variant="outline">{t(`templates.${s.template_key as "parcel"}`)}</Badge><Badge>{t(`statuses.${s.status as "draft"}`)}</Badge></div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("funnel")}>
              {steps.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{t(k)}</dt>
                  <dd className="font-display text-2xl font-bold">{v}{s.sent > 0 && k !== "sent" && <span className="ml-1 text-sm font-normal text-muted-foreground">{Math.round((v / s.sent) * 100)}%</span>}</dd>
                  <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-primary" style={{ width: `${s.sent ? Math.min(100, (v / s.sent) * 100) : 0}%` }} /></div>
                </div>
              ))}
            </dl>
            {canEdit && s.status === "draft" && (
              <div className="space-y-2">
                <Label htmlFor={`em-${s.id}`}>{t("emails")}</Label>
                <Textarea id={`em-${s.id}`} rows={4} value={emails[s.id] ?? ""} onChange={(e) => setEmails({ ...emails, [s.id]: e.target.value })} className="font-mono text-xs" />
                <p className="text-xs text-muted-foreground">{t("emailsHint")}</p>
                <Button disabled={pending} onClick={() => run(() => launchSimulation({ id: s.id, emails: (emails[s.id] ?? "").split(/[\s,;]+/).filter(Boolean) }), (r) => t("launched", { count: (r as R & { data: { count: number } }).data.count }))}><Play className="size-4" aria-hidden="true" />{t("launch")}</Button>
              </div>
            )}
            {canEdit && s.status === "running" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => finishSimulation({ id: s.id }))}><Square className="size-4" aria-hidden="true" />{t("finish")}</Button>}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- B9 API keys ---------------- */
export function ApiKeyCreator() {
  const t = useTranslations("biz.api");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set(["scan"]));
  const [key, setKey] = useState<string | null>(null);
  const { pending, run } = useRun();
  return (
    <div className="glass-card space-y-3 rounded-xl p-4">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => createApiKey({ name, scopes: [...scopes] }), undefined, (r) => { setKey((r as R & { data: { key: string } }).data.key); setName(""); }); }}>
        <div className="flex-1 space-y-1.5"><Label htmlFor="key-name">{t("name")}</Label><Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <fieldset className="space-y-1"><legend className="text-xs text-muted-foreground">{t("scopes")}</legend>
          {(["scan", "iocs"] as const).map((s) => <label key={s} className="flex items-center gap-2 text-xs"><Checkbox checked={scopes.has(s)} onCheckedChange={(v) => setScopes((x) => { const n = new Set(x); if (v) n.add(s); else n.delete(s); return n; })} />{t(s === "scan" ? "scopeScan" : "scopeIocs")}</label>)}
        </fieldset>
        <Button type="submit" disabled={pending || name.trim().length < 2 || !scopes.size}><KeyRound className="size-4" aria-hidden="true" />{t("create")}</Button>
      </form>
      {key && (
        <Alert role="status"><AlertDescription className="space-y-2"><p className="font-medium">{t("once")}</p><div className="flex items-center gap-2 rounded bg-muted p-2"><code className="flex-1 font-mono text-xs break-all">{key}</code><CopyButton value={key} /></div></AlertDescription></Alert>
      )}
    </div>
  );
}
export function RevokeKeyButton({ id }: { id: string }) {
  const t = useTranslations("biz.api");
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => revokeApiKey({ id }), t("revoked"))}>{t("revoke")}</Button>;
}

/* ---------------- B10 team ---------------- */
const ORG_ROLES = ["owner", "admin", "security", "comms", "finance", "viewer", "contact"] as const;
export function InviteMemberForm() {
  const t = useTranslations("biz.team");
  const tr = useTranslations("orgRoles");
  const [v, setV] = useState({ email: "", role: "viewer" });
  const { pending, run } = useRun();
  return (
    <form className="glass-card flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => inviteMember(v), t("invited"), () => setV({ ...v, email: "" })); }}>
      <div className="flex-1 space-y-1.5"><Label htmlFor="tm-email">{t("email")}</Label><Input id="tm-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></div>
      <div className="space-y-1.5"><Label htmlFor="tm-role">{t("role")}</Label>
        <Select value={v.role} onValueChange={(x) => setV({ ...v, role: x })}><SelectTrigger id="tm-role" className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ORG_ROLES.map((r) => <SelectItem key={r} value={r}>{tr(r)}</SelectItem>)}</SelectContent></Select></div>
      <Button type="submit" disabled={pending}><UserPlus className="size-4" aria-hidden="true" />{t("invite")}</Button>
    </form>
  );
}
export function MemberRow({ userId, name, role, isSelf, canEdit }: { userId: string; name: string; role: string; isSelf: boolean; canEdit: boolean }) {
  const t = useTranslations("biz.team");
  const tr = useTranslations("orgRoles");
  const { pending, run } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
      <span className="font-medium">{name}</span>{isSelf && <Badge variant="secondary">{t("you")}</Badge>}
      <span className="ml-auto flex items-center gap-2">
        {canEdit && !isSelf ? (
          <Select value={role} disabled={pending} onValueChange={(x) => run(() => setMemberRole({ userId, role: x }))}><SelectTrigger className="h-8 w-40" aria-label={`${t("role")}: ${name}`}><SelectValue /></SelectTrigger>
            <SelectContent>{ORG_ROLES.map((r) => <SelectItem key={r} value={r}>{tr(r)}</SelectItem>)}</SelectContent></Select>
        ) : <Badge variant="outline">{tr(role as "owner")}</Badge>}
        {canEdit && !isSelf && <Button size="icon" variant="ghost" className="size-8" aria-label={`${t("remove")}: ${name}`} disabled={pending} onClick={() => run(() => removeMember({ userId }))}><Trash2 className="size-4" /></Button>}
      </span>
    </li>
  );
}

/* ---------------- B11 export ---------------- */
export function ExportForm() {
  const t = useTranslations("biz.export");
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)); return d.toISOString().slice(0, 7); });
  const [month, setMonth] = useState(months[0]);
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [url, setUrl] = useState<string | null>(null);
  const { pending, run } = useRun();
  return (
    <div className="glass-card space-y-4 rounded-xl p-4">
      <p className="text-sm text-muted-foreground">{t("contents")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5"><Label htmlFor="ex-m">{t("month")}</Label><Select value={month} onValueChange={setMonth}><SelectTrigger id="ex-m" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="ex-f">{t("format")}</Label><Select value={format} onValueChange={(v) => setFormat(v as "pdf")}><SelectTrigger id="ex-f" className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pdf">PDF</SelectItem><SelectItem value="csv">CSV</SelectItem></SelectContent></Select></div>
        <Button disabled={pending} onClick={() => run(() => generateComplianceExport({ month, format }), undefined, (r) => setUrl((r as R & { data: { url: string } }).data.url))}>{t("generate")}</Button>
      </div>
      {url && <Alert role="status"><AlertDescription className="flex flex-wrap items-center gap-3">{t("ready")}<Button asChild size="sm"><a href={url} target="_blank" rel="noopener noreferrer"><Download className="size-4" aria-hidden="true" />{t("download")}</a></Button></AlertDescription></Alert>}
    </div>
  );
}

/* ---------------- B12 settings ---------------- */
export function OrgSettingsForm({ name, emails, retention, plan, canEdit }: { name: string; emails: string[]; retention: number; plan: string; canEdit: boolean }) {
  const t = useTranslations("biz.settings");
  const tu = useTranslations("ui");
  const [v, setV] = useState({ name, emails: emails.join("\n"), retention });
  const { pending, run } = useRun();
  const locale = useLocale();
  return (
    <form className="glass-card max-w-2xl space-y-4 rounded-xl p-5" onSubmit={(e) => { e.preventDefault(); run(() => saveOrgSettings({ name: v.name, notificationEmails: v.emails.split(/\s+/).filter(Boolean), retentionDays: v.retention }), tu("saved")); }}>
      <h2 className="font-medium">{t("profile")} <Badge variant="outline" className="ml-2">{t("plan")}: {plan}</Badge></h2>
      <div className="space-y-1.5"><Label htmlFor="os-name">{t("name")}</Label><Input id="os-name" value={v.name} disabled={!canEdit} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="os-em">{t("notifications")}</Label><Textarea id="os-em" rows={3} value={v.emails} disabled={!canEdit} onChange={(e) => setV({ ...v, emails: e.target.value })} className="font-mono text-xs" /><p className="text-xs text-muted-foreground">{t("notificationsHint")}</p></div>
      <div className="space-y-1.5"><Label htmlFor="os-ret">{t("retention")}</Label><Input id="os-ret" type="number" min={30} max={1825} lang={locale} value={v.retention} disabled={!canEdit} onChange={(e) => setV({ ...v, retention: Number(e.target.value) })} className="w-32" /></div>
      {canEdit && <Button type="submit" disabled={pending}>{tu("save")}</Button>}
    </form>
  );
}

