"use client";

import {
  AtSign, BadgeCheck, Check, CheckCircle2, Globe, KeyRound, Mail, MessageSquare, MonitorSmartphone,
  Phone, Plus, Send, ShieldCheck, Tag, Trash2, UserPlus, type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addBrandAsset, allowlistOwnDomain, createApiKey, escalateBrandAlert, getVerificationToken, inviteMember, removeBrandAsset, removeMember, requestDomainTakedown, revokeApiKey, saveOrgSettings, setMemberRole, updateBrandAlert, verifyBrandDomain,
} from "@/app/[locale]/business/_actions";
import { SettingsRow } from "@/components/layout/dash";
import { CopyButton } from "@/components/shared/copy-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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

/** Radio choices drawn as icon tiles. */
function TileChoice<T extends string>({ label, value, onChange, options, cols = "grid-cols-2 sm:grid-cols-3" }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; icon: LucideIcon }[]; cols?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", cols)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              on ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-accent/50",
            )}
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              <o.icon className="size-4" aria-hidden="true" />
            </span>
            <span className="leading-snug">{o.label}</span>
            {on && <Check className="absolute top-2 right-2 size-3.5 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function initials(name: string) {
  const p = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

/* ---------------- B2 brand setup ---------------- */
const KINDS = ["domain", "brand_name", "sms_sender", "phone", "social"] as const;
const KIND_ICON: Record<(typeof KINDS)[number], LucideIcon> = { domain: Globe, brand_name: Tag, sms_sender: MessageSquare, phone: Phone, social: AtSign };
type Asset = { id: string; kind: string; value: string; verified_at: string | null };

function VerifyDialog({ asset }: { asset: Asset }) {
  const t = useTranslations("biz.onboarding");
  const [token, setToken] = useState<string | null>(null);
  const { pending, run } = useRun();
  return (
    <Dialog onOpenChange={(o) => o && !token && getVerificationToken({ domain: asset.value }).then((r) => r.ok && setToken(r.data.token))}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="h-8 rounded-full"><ShieldCheck className="size-4" aria-hidden="true" />{t("verify")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("verifyTitle", { domain: asset.value })}</DialogTitle><DialogDescription>{t("verifyNote")}</DialogDescription></DialogHeader>
        {token && (
          <div className="space-y-3 text-sm">
            <p>{t("verifyDns")}</p>
            <div className="flex items-center gap-2 rounded-lg bg-muted p-2"><code className="flex-1 font-mono text-xs break-all">{token}</code><CopyButton value={token} /></div>
            <p>{t("verifyFile", { domain: asset.value })}</p>
            <Button className="rounded-full" disabled={pending} onClick={() => run(() => verifyBrandDomain({ id: asset.id }), t("verifyOk"))}>{t("verifyNow")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AssetManager({ assets, canEdit }: { assets: Asset[]; canEdit: boolean }) {
  const t = useTranslations("biz.onboarding");
  const tb = useTranslations("biz");
  const tu = useTranslations("ui");
  const [values, setValues] = useState<Record<string, string>>({});
  const { pending, run } = useRun();
  const done = KINDS.filter((k) => assets.some((a) => a.kind === k)).length;
  const firstOpen = KINDS.find((k) => !assets.some((a) => a.kind === k));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3">
          <p className="font-display text-xl font-medium">{tb("ob.progress", { done, total: KINDS.length })}</p>
          <Progress value={(done / KINDS.length) * 100} className="h-2.5" aria-label={tb("ob.progress", { done, total: KINDS.length })} />
        </CardContent>
      </Card>

      <ol className="relative space-y-4">
        <span aria-hidden="true" className="absolute top-6 bottom-6 left-[1.4rem] w-0.5 bg-border" />
        {KINDS.map((k, i) => {
          const list = assets.filter((a) => a.kind === k);
          const isDone = list.length > 0;
          const isNext = k === firstOpen;
          const Icon = KIND_ICON[k];
          return (
            <li key={k} className="relative flex gap-4">
              <span
                className={cn(
                  "relative z-10 grid size-11 shrink-0 place-items-center rounded-full border-2 bg-background font-display font-semibold",
                  isDone && "border-flag-green bg-flag-green text-background",
                  isNext && "border-primary text-primary ring-4 ring-primary/15",
                  !isDone && !isNext && "border-border text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-5" aria-hidden="true" /> : i + 1}
              </span>
              <Card className={cn("flex-1 gap-4 py-5", isNext && "border-primary/50")}>
                <CardHeader className="px-5">
                  <div className="flex items-center gap-3">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", isNext ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("step", { n: i + 1 })}</p>
                      <CardTitle className="font-display text-lg">{t(`kinds.${k}`)}</CardTitle>
                    </div>
                    <span className={cn("ml-auto rounded-full border px-2.5 py-0.5 text-xs", isDone ? "border-flag-green/40 text-flag-green" : "border-border text-muted-foreground")}>
                      {tb("ob.count", { count: list.length })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-5">
                  {list.length > 0 && (
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {list.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                          <span className={cn("min-w-0 flex-1 truncate", (k === "domain" || k === "sms_sender") && "font-mono")}>{k === "domain" ? a.value.replace(/\./g, "[.]") : a.value}</span>
                          {k === "domain" && (a.verified_at
                            ? <Badge className="gap-1 bg-flag-green/15 text-flag-green"><BadgeCheck className="size-3" aria-hidden="true" />{t("verified")}</Badge>
                            : <Badge variant="outline">{t("unverified")}</Badge>)}
                          {k === "domain" && !a.verified_at && canEdit && <VerifyDialog asset={a} />}
                          {canEdit && (
                            <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`${tu("remove")} ${a.value}`} disabled={pending} onClick={() => run(() => removeBrandAsset({ id: a.id }))}>
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addBrandAsset({ kind: k, value: values[k] ?? "" }), tu("saved"), () => setValues({ ...values, [k]: "" })); }}>
                      <Label htmlFor={`asset-${k}`} className="sr-only">{t(`kinds.${k}`)}</Label>
                      <Input id={`asset-${k}`} value={values[k] ?? ""} onChange={(e) => setValues({ ...values, [k]: e.target.value })} placeholder={t(`placeholders.${k}`)} className={cn("h-10 rounded-xl", k === "domain" && "font-mono")} />
                      <Button type="submit" variant={isNext ? "default" : "outline"} className="h-10 rounded-xl" disabled={pending || !(values[k] ?? "").trim()}><Plus className="size-4" aria-hidden="true" />{t("add")}</Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- B3 alerts ---------------- */
export function AlertActions({ id, status, canAct }: { id: string; status: string; canAct: boolean }) {
  const t = useTranslations("biz.alerts");
  const { pending, run } = useRun();
  if (!canAct || status === "resolved") return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {status !== "escalated" && (
        <Button size="sm" className="rounded-full" disabled={pending} onClick={() => run(() => escalateBrandAlert({ id }), (r) => t("escalated", { protocol: (r as R & { data: { protocol: string } }).data.protocol }))}>
          <Send className="size-4" aria-hidden="true" />{t("escalate")}
        </Button>
      )}
      {status === "new" && (
        <Button size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={() => run(() => updateBrandAlert({ id, status: "acknowledged" }), t("statuses.acknowledged"))}>{t("acknowledge")}</Button>
      )}
      <Button size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={() => run(() => updateBrandAlert({ id, status: "resolved" }), t("statuses.resolved"))}>
        <CheckCircle2 className="size-4" aria-hidden="true" />{t("resolve")}
      </Button>
    </div>
  );
}

/* ---------------- B5 domains ---------------- */
export function DomainActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("biz.domains");
  const td = useTranslations("soc.domains");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-nowrap gap-1">
      {!["taken_down", "allowlisted"].includes(status) && (
        <Button size="sm" variant="outline" className="h-8 rounded-full" disabled={pending} onClick={() => run(() => requestDomainTakedown({ id }), (r) => t("requested", { protocol: (r as R & { data: { protocol: string } }).data.protocol }))}>
          {t("requestTakedown")}
        </Button>
      )}
      {status !== "allowlisted" && (
        <Button size="sm" variant="ghost" className="h-8 rounded-full" disabled={pending} title={t("allowlistHint")} onClick={() => run(() => allowlistOwnDomain({ id }), td("statuses.allowlisted"))}>
          {td("allowlist")}
        </Button>
      )}
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
const CHANNEL_ICON = { sms: MessageSquare, email: Mail, banner: MonitorSmartphone } as const;

export function NoticeComposer({ brand, campaigns }: { brand: string; campaigns: Camp[] }) {
  const t = useTranslations("biz.notices");
  const tb = useTranslations("biz");
  const [cid, setCid] = useState(campaigns[0]?.id ?? "");
  const [channel, setChannel] = useState<"sms" | "email" | "banner">("sms");
  const c = campaigns.find((x) => x.id === cid);
  const domain = (c?.domains[0] ?? "—").replace(/\./g, "[.]");
  const tactic = c?.tactic.replace(/_/g, " ") ?? "";
  const texts = useMemo(() => ({ sq: channel === "email" ? NOTICE.sq.email(brand, domain, tactic) : NOTICE.sq[channel](brand, domain), en: channel === "email" ? NOTICE.en.email(brand, domain, tactic) : NOTICE.en[channel](brand, domain) }), [brand, domain, tactic, channel]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const key = (l: "sq" | "en") => `${cid}:${channel}:${l}`;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <Card className="xl:sticky xl:top-20 xl:col-span-4">
        <CardHeader>
          <CardTitle className="font-display text-lg">{tb("nt.setup")}</CardTitle>
          <CardDescription>{t("out")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="cn-c">{t("campaign")}</Label>
            <Select value={cid} onValueChange={setCid}>
              <SelectTrigger id="cn-c" className="h-11 data-[size=default]:h-11 w-full rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{campaigns.map((x) => <SelectItem key={x.id} value={x.id}>{x.code} · {x.tactic.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("channel")}</p>
            <p className="text-xs text-muted-foreground">{tb("nt.channelHint")}</p>
            <TileChoice label={t("channel")} value={channel} onChange={setChannel} cols="grid-cols-1 sm:grid-cols-3 xl:grid-cols-1" options={(["sms", "email", "banner"] as const).map((x) => ({ value: x, label: t(`channels.${x}`), icon: CHANNEL_ICON[x] }))} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 xl:col-span-8">
        {(["sq", "en"] as const).map((l) => {
          const value = edited[key(l)] ?? texts[l];
          const over = channel === "sms" && value.length > 160;
          return (
            <Card key={l} lang={l} className="gap-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="rounded-md bg-primary/12 px-1.5 py-0.5 font-mono text-xs text-primary">{l.toUpperCase()}</span>
                  <Label htmlFor={`cn-${l}`}>{t("preview")}</Label>
                </CardTitle>
                <CardDescription className={cn(over && "text-flag-orange")}>
                  {t("chars", { count: value.length })}{channel === "sms" && ` · ${tb("nt.sms")}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea id={`cn-${l}`} value={value} onChange={(e) => setEdited({ ...edited, [key(l)]: e.target.value })} rows={channel === "email" ? 16 : 6} className="rounded-xl text-sm leading-relaxed" />
                <CopyButton size="sm" value={value} label={t("copy")} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


export function ApiKeyCreator() {
  const t = useTranslations("biz.api");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set(["scan"]));
  const [key, setKey] = useState<string | null>(null);
  const { pending, run } = useRun();
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-lg">{t("new")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(() => createApiKey({ name, scopes: [...scopes] }), undefined, (r) => { setKey((r as R & { data: { key: string } }).data.key); setName(""); }); }}>
          <div className="space-y-1.5">
            <Label htmlFor="key-name">{t("name")}</Label>
            <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">{t("scopes")}</legend>
            {(["scan", "iocs"] as const).map((s) => {
              const on = scopes.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setScopes((x) => { const n = new Set(x); if (on) n.delete(s); else n.add(s); return n; })}
                  className={cn("flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", on ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}
                >
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="size-3.5" aria-hidden="true" />}</span>
                  <span className="font-mono text-xs">{t(s === "scan" ? "scopeScan" : "scopeIocs")}</span>
                </button>
              );
            })}
          </fieldset>
          <Button type="submit" className="w-full rounded-full" disabled={pending || name.trim().length < 2 || !scopes.size}><KeyRound className="size-4" aria-hidden="true" />{t("create")}</Button>
        </form>
        {key && (
          <Alert role="status" className="border-flag-orange/40 bg-flag-orange/5">
            <AlertDescription className="space-y-2 text-foreground">
              <p className="font-medium">{t("once")}</p>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-2"><code className="flex-1 font-mono text-xs break-all">{key}</code><CopyButton value={key} /></div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
export function RevokeKeyButton({ id }: { id: string }) {
  const t = useTranslations("biz.api");
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" className="h-8 rounded-full text-muted-foreground hover:text-destructive" disabled={pending} onClick={() => run(() => revokeApiKey({ id }), t("revoked"))}>{t("revoke")}</Button>;
}

/* ---------------- B10 team ---------------- */
const ORG_ROLES = ["owner", "admin", "security", "comms", "finance", "viewer", "contact"] as const;
export function InviteMemberForm() {
  const t = useTranslations("biz.team");
  const tr = useTranslations("orgRoles");
  const [v, setV] = useState({ email: "", role: "viewer" });
  const { pending, run } = useRun();
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-lg">{t("invite")}</CardTitle></CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={(e) => { e.preventDefault(); run(() => inviteMember(v), t("invited"), () => setV({ ...v, email: "" })); }}>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tm-email">{t("email")}</Label>
            <Input id="tm-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-role">{t("role")}</Label>
            <Select value={v.role} onValueChange={(x) => setV({ ...v, role: x })}>
              <SelectTrigger id="tm-role" className="h-11 data-[size=default]:h-11 w-full rounded-xl lg:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{ORG_ROLES.map((r) => <SelectItem key={r} value={r}>{tr(r)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" className="h-11 rounded-full px-6" disabled={pending}><UserPlus className="size-4" aria-hidden="true" />{t("invite")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
export function MemberRow({ userId, name, role, isSelf, canEdit }: { userId: string; name: string; role: string; isSelf: boolean; canEdit: boolean }) {
  const t = useTranslations("biz.team");
  const tr = useTranslations("orgRoles");
  const { pending, run } = useRun();
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary" aria-hidden="true">{initials(name)}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{name}</span>
        {isSelf && <Badge variant="secondary" className="ml-2">{t("you")}</Badge>}
      </span>
      <span className="flex items-center gap-2">
        {canEdit && !isSelf ? (
          <Select value={role} disabled={pending} onValueChange={(x) => run(() => setMemberRole({ userId, role: x }))}>
            <SelectTrigger className="w-44 rounded-lg" aria-label={`${t("role")}: ${name}`}><SelectValue /></SelectTrigger>
            <SelectContent>{ORG_ROLES.map((r) => <SelectItem key={r} value={r}>{tr(r)}</SelectItem>)}</SelectContent>
          </Select>
        ) : <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium">{tr(role as "owner")}</span>}
        {canEdit && !isSelf && (
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`${t("remove")}: ${name}`} disabled={pending} onClick={() => run(() => removeMember({ userId }))}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        )}
      </span>
    </li>
  );
}

export function OrgSettingsForm({ name, emails, retention, plan, canEdit }: { name: string; emails: string[]; retention: number; plan: string; canEdit: boolean }) {
  const t = useTranslations("biz.settings");
  const tb = useTranslations("biz");
  const tu = useTranslations("ui");
  const locale = useLocale();
  const initial = { name, emails: emails.join("\n"), retention };
  const [v, setV] = useState(initial);
  const { pending, run } = useRun();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  return (
    <form className="divide-y divide-border" onSubmit={(e) => { e.preventDefault(); run(() => saveOrgSettings({ name: v.name, notificationEmails: v.emails.split(/\s+/).filter(Boolean), retentionDays: v.retention }), tu("saved")); }}>
      <SettingsRow title={t("profile")} hint={tb("st.profileHint")}>
        <div className="max-w-2xl space-y-1.5">
          <Label htmlFor="os-name">{t("name")}</Label>
          <Input id="os-name" value={v.name} disabled={!canEdit} onChange={(e) => setV({ ...v, name: e.target.value })} className="h-11 rounded-xl" />
        </div>
      </SettingsRow>
      <SettingsRow title={tb("st.planTitle")} hint={tb("st.planHint")}>
        <span className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium capitalize"><BadgeCheck className="size-4 text-primary" aria-hidden="true" />{plan}</span>
      </SettingsRow>
      <SettingsRow title={t("notifications")} hint={tb("st.notifHint")}>
        <div className="max-w-2xl space-y-1.5">
          <Label htmlFor="os-em" className="sr-only">{t("notifications")}</Label>
          <Textarea id="os-em" rows={4} value={v.emails} disabled={!canEdit} onChange={(e) => setV({ ...v, emails: e.target.value })} className="rounded-xl font-mono text-sm" />
          <p className="text-xs text-muted-foreground">{t("notificationsHint")}</p>
        </div>
      </SettingsRow>
      <SettingsRow title={t("retention")} hint={tb("st.retentionHint")}>
        <div className="flex items-center gap-2">
          <Label htmlFor="os-ret" className="sr-only">{t("retention")}</Label>
          <Input id="os-ret" type="number" min={30} max={1825} lang={locale} value={v.retention} disabled={!canEdit} onChange={(e) => setV({ ...v, retention: Number(e.target.value) })} className="h-11 w-32 rounded-xl" />
          <span className="text-sm text-muted-foreground">{tb("st.days")}</span>
        </div>
      </SettingsRow>
      {canEdit && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 bg-background/90 py-4 backdrop-blur">
          {dirty && <p className="text-sm text-muted-foreground" aria-live="polite">{tb("st.unsaved")}</p>}
          <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => setV(initial)}>{tu("cancel")}</Button>
          <Button type="submit" className="rounded-full px-6" disabled={!dirty || pending}>{tu("save")}</Button>
        </div>
      )}
    </form>
  );
}
