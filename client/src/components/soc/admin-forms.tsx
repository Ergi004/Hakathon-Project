"use client";

import { Plus, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addOfficialChannel, addOfficialDomain, changeRole, inviteStaff, removeOfficialChannel, removeOfficialDomain, saveRecipient, saveSetting, saveTemplate, upsertInstitution } from "@/app/[locale]/soc/_actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  return { pending, run: (fn: () => Promise<R>, after?: () => void) => start(async () => { const r = await fn(); if (r.ok) { toast.success(tu("saved")); after?.(); router.refresh(); } else toast.error(r.error === "forbidden" ? tu("errorForbidden") : r.message ?? tu("errorGeneric")); }) };
}
const ROLES = ["user", "soc_analyst", "soc_lead", "platform_admin"] as const;
const SECTORS = ["government", "municipality", "bank", "postal", "utility", "telecom", "police", "other"] as const;

export function RoleSelect({ userId, role, disabled }: { userId: string; role: (typeof ROLES)[number]; disabled: boolean }) {
  const tr = useTranslations("roles");
  const { pending, run } = useRun();
  return (
    <Select value={role} disabled={disabled || pending} onValueChange={(v) => run(() => changeRole({ userId, role: v }))}>
      <SelectTrigger className="h-8 w-44" aria-label={tr(role)}><SelectValue /></SelectTrigger>
      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{tr(r)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function InviteForm() {
  const t = useTranslations("soc.admin");
  const tr = useTranslations("roles");
  const [v, setV] = useState({ email: "", name: "", role: "soc_analyst" });
  const { pending, run } = useRun();
  return (
    <form className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); run(() => inviteStaff(v), () => setV({ email: "", name: "", role: v.role })); }}>
      <div className="space-y-1.5"><Label htmlFor="inv-email">{t("email")}</Label><Input id="inv-email" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="inv-name">{t("name")}</Label><Input id="inv-name" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="inv-role">{t("role")}</Label>
        <Select value={v.role} onValueChange={(x) => setV({ ...v, role: x })}><SelectTrigger id="inv-role" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.filter((r) => r !== "user").map((r) => <SelectItem key={r} value={r}>{tr(r)}</SelectItem>)}</SelectContent></Select></div>
      <Button type="submit" disabled={pending}><UserPlus className="size-4" aria-hidden="true" />{t("invite")}</Button>
    </form>
  );
}

export function InstitutionCard({ inst }: { inst: { id: string; name: string; sector: string; official_domains: { id: string; domain: string }[]; official_channels: { id: string; kind: string; value: string }[] } }) {
  const t = useTranslations("soc.admin");
  const ts = useTranslations("sector");
  const tk = useTranslations("institutions.kinds");
  const tu = useTranslations("ui");
  const [domain, setDomain] = useState("");
  const [ch, setCh] = useState({ kind: "sms_sender", value: "" });
  const { pending, run } = useRun();
  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{inst.name}</p>
        <Select value={inst.sector} onValueChange={(v) => run(() => upsertInstitution({ id: inst.id, name: inst.name, sector: v }))}>
          <SelectTrigger className="h-7 w-40 text-xs" aria-label={t("sector")}><SelectValue /></SelectTrigger>
          <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        {inst.official_domains.map((d) => (
          <Badge key={d.id} variant="outline" className="gap-1 font-mono">{d.domain}<button type="button" aria-label={`${tu("remove")} ${d.domain}`} onClick={() => run(() => removeOfficialDomain({ id: d.id }))}><Trash2 className="size-3" /></button></Badge>
        ))}
        {inst.official_channels.map((c) => (
          <Badge key={c.id} variant="secondary" className="gap-1">{tk(c.kind as "phone")}: {c.value}<button type="button" aria-label={`${tu("remove")} ${c.value}`} onClick={() => run(() => removeOfficialChannel({ id: c.id }))}><Trash2 className="size-3" /></button></Badge>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addOfficialDomain({ institutionId: inst.id, domain }), () => setDomain("")); }}>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t("officialDomain")} aria-label={t("officialDomain")} className="font-mono" />
          <Button type="submit" size="icon" variant="outline" disabled={pending || !domain} aria-label={tu("add")}><Plus className="size-4" /></Button>
        </form>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addOfficialChannel({ institutionId: inst.id, ...ch }), () => setCh({ ...ch, value: "" })); }}>
          <Select value={ch.kind} onValueChange={(k) => setCh({ ...ch, kind: k })}><SelectTrigger className="w-36" aria-label={t("channelKind")}><SelectValue /></SelectTrigger>
            <SelectContent>{(["sms_sender", "phone", "social", "email"] as const).map((k) => <SelectItem key={k} value={k}>{tk(k)}</SelectItem>)}</SelectContent></Select>
          <Input value={ch.value} onChange={(e) => setCh({ ...ch, value: e.target.value })} placeholder={t("channelValue")} aria-label={t("channelValue")} />
          <Button type="submit" size="icon" variant="outline" disabled={pending || !ch.value} aria-label={tu("add")}><Plus className="size-4" /></Button>
        </form>
      </div>
    </div>
  );
}

export function NewInstitutionForm() {
  const t = useTranslations("soc.admin");
  const ts = useTranslations("sector");
  const tu = useTranslations("ui");
  const [v, setV] = useState({ name: "", sector: "government" });
  const { pending, run } = useRun();
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); run(() => upsertInstitution(v), () => setV({ ...v, name: "" })); }}>
      <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder={t("name")} aria-label={t("name")} />
      <Select value={v.sector} onValueChange={(x) => setV({ ...v, sector: x })}><SelectTrigger className="sm:w-44" aria-label={t("sector")}><SelectValue /></SelectTrigger>
        <SelectContent>{SECTORS.map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}</SelectContent></Select>
      <Button type="submit" disabled={pending || v.name.length < 2}><Plus className="size-4" aria-hidden="true" />{tu("add")}</Button>
    </form>
  );
}

export function TemplateEditor({ templates }: { templates: { kind: string; locale: string; version: number; subject: string; body: string }[] }) {
  const t = useTranslations("soc.admin");
  const tk = useTranslations("noticeType");
  const tu = useTranslations("ui");
  const te = useTranslations("soc.takedowns.editor");
  const [key, setKey] = useState(templates[0] ? `${templates[0].kind}.${templates[0].locale}` : "registrar.sq");
  const current = templates.find((x) => `${x.kind}.${x.locale}` === key);
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const { pending, run } = useRun();
  const pick = (k: string) => { setKey(k); const c = templates.find((x) => `${x.kind}.${x.locale}` === k); setSubject(c?.subject ?? ""); setBody(c?.body ?? ""); };
  const [kind, locale] = key.split(".");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={key} onValueChange={pick}><SelectTrigger className="w-56" aria-label={t("version")}><SelectValue /></SelectTrigger>
          <SelectContent>{["registrar", "hosting", "akcesk"].flatMap((k) => ["sq", "en"].map((l) => <SelectItem key={`${k}.${l}`} value={`${k}.${l}`}>{tk(k as "registrar")} · {l}</SelectItem>))}</SelectContent></Select>
        {current && <Badge variant="outline">{t("version")} {current.version}</Badge>}
      </div>
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={te("subject")} />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} className="font-mono text-xs" aria-label={tu("details")} />
      <Button disabled={pending} onClick={() => run(() => saveTemplate({ kind, locale, subject, body }))}>{tu("save")}</Button>
    </div>
  );
}

export function RecipientForm({ r }: { r?: { id: string; kind: string; name: string; abuse_email: string; match_pattern: string | null; sla_hours: number } }) {
  const t = useTranslations("soc.admin");
  const tk = useTranslations("noticeType");
  const tu = useTranslations("ui");
  const tt = useTranslations("soc.takedowns");
  const [v, setV] = useState({ kind: r?.kind ?? "registrar", name: r?.name ?? "", abuse_email: r?.abuse_email ?? "", match_pattern: r?.match_pattern ?? "", sla_hours: r?.sla_hours ?? 24 });
  const { pending, run } = useRun();
  return (
    <form className="grid gap-2 md:grid-cols-[9rem_1fr_1fr_1fr_6rem_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); run(() => saveRecipient({ ...v, id: r?.id, match_pattern: v.match_pattern || undefined })); }}>
      <Select value={v.kind} onValueChange={(x) => setV({ ...v, kind: x })}><SelectTrigger aria-label={tt("kind")}><SelectValue /></SelectTrigger>
        <SelectContent>{(["registrar", "hosting", "akcesk"] as const).map((k) => <SelectItem key={k} value={k}>{tk(k)}</SelectItem>)}</SelectContent></Select>
      <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label={t("name")} placeholder={t("name")} />
      <Input value={v.abuse_email} onChange={(e) => setV({ ...v, abuse_email: e.target.value })} aria-label={t("abuseEmail")} placeholder="abuse@x.example" className="font-mono" />
      <Input value={v.match_pattern} onChange={(e) => setV({ ...v, match_pattern: e.target.value })} aria-label={t("pattern")} placeholder={t("pattern")} />
      <Input type="number" min={1} value={v.sla_hours} onChange={(e) => setV({ ...v, sla_hours: Number(e.target.value) })} aria-label={t("slaHours")} />
      <Button type="submit" variant={r ? "outline" : "default"} disabled={pending}>{r ? tu("save") : tu("add")}</Button>
    </form>
  );
}

export function SettingsForm({ thresholds, weights, autoEscalate, canEdit }: { thresholds: Record<string, number>; weights: Record<string, number>; autoEscalate: number; canEdit: boolean }) {
  const t = useTranslations("soc.admin");
  const tu = useTranslations("ui");
  const [th, setTh] = useState(thresholds);
  const [w, setW] = useState(weights);
  const [ae, setAe] = useState(autoEscalate);
  const { pending, run } = useRun();
  const grid = (obj: Record<string, number>, set: (o: Record<string, number>) => void, prefix: string) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="space-y-1"><Label htmlFor={`${prefix}-${k}`} className="text-xs">{k}</Label><Input id={`${prefix}-${k}`} type="number" value={v} disabled={!canEdit} onChange={(e) => set({ ...obj, [k]: Number(e.target.value) })} /></div>
      ))}
    </div>
  );
  return (
    <div className="space-y-5">
      {!canEdit && <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>}
      <section className="space-y-2"><h3 className="font-medium">{t("thresholds")}</h3>{grid(th, setTh, "th")}<Button size="sm" disabled={!canEdit || pending} onClick={() => run(() => saveSetting({ key: "thresholds", value: th }))}>{tu("save")}</Button></section>
      <section className="space-y-2"><h3 className="font-medium">{t("weights")}</h3>{grid(w, setW, "w")}<Button size="sm" disabled={!canEdit || pending} onClick={() => run(() => saveSetting({ key: "weights", value: w }))}>{tu("save")}</Button></section>
      <section className="space-y-2"><h3 className="font-medium">{t("autoEscalate")}</h3><Input type="number" className="w-32" value={ae} disabled={!canEdit} onChange={(e) => setAe(Number(e.target.value))} aria-label={t("autoEscalate")} /><Button size="sm" disabled={!canEdit || pending} onClick={() => run(() => saveSetting({ key: "auto_escalate_hours", value: ae }))}>{tu("save")}</Button></section>
    </div>
  );
}
