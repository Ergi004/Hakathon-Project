"use client";

import { Eye, EyeOff, GitMerge, Gavel, Plus, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCampaign, mergeCampaigns, publishCampaign, splitCampaign, updateCampaign } from "@/app/[locale]/soc/_actions/campaigns";
import { createTakedown } from "@/app/[locale]/soc/takedowns/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    run: (fn: () => Promise<R>, ok?: string, after?: () => void) =>
      start(async () => {
        const r = await fn();
        if (r.ok) {
          if (ok) toast.success(ok);
          after?.();
          router.refresh();
        } else toast.error(r.error === "forbidden" ? tu("errorForbidden") : r.message === "notConfirmed" ? r.message : tu("errorGeneric"));
      }),
  };
}

const SEV = ["low", "medium", "high", "critical"] as const;
const STATUS = ["monitoring", "confirmed", "takedown_in_progress", "resolved"] as const;

export function CampaignControls({ id, status, severity, ownerId, isPublic, isLead, staff }: { id: string; status: (typeof STATUS)[number]; severity: (typeof SEV)[number]; ownerId: string | null; isPublic: boolean; isLead: boolean; staff: { id: string; full_name: string | null }[] }) {
  const t = useTranslations("soc.campaign");
  const tc = useTranslations("campaignStatus");
  const ts = useTranslations("severity");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground" htmlFor="c-status">{t("changeStatus")}</Label>
        <Select value={status} onValueChange={(v) => run(() => updateCampaign({ id, status: v }), tc(v as "confirmed"))} disabled={pending}>
          <SelectTrigger id="c-status" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{tc(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground" htmlFor="c-sev">{t("severity")}</Label>
        <Select value={severity} onValueChange={(v) => run(() => updateCampaign({ id, severity: v }))} disabled={pending}>
          <SelectTrigger id="c-sev" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{SEV.map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground" htmlFor="c-owner">{t("assignOwner")}</Label>
        <Select value={ownerId ?? "__none"} onValueChange={(v) => run(() => updateCampaign({ id, ownerId: v === "__none" ? null : v }))} disabled={pending}>
          <SelectTrigger id="c-owner" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name ?? s.id.slice(0, 8)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLead ? (
        <Button variant={isPublic ? "outline" : "default"} disabled={pending || (!isPublic && status === "monitoring")} onClick={() => run(() => publishCampaign({ id, publish: !isPublic }))}>
          {isPublic ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          {isPublic ? t("unpublish") : t("publish")}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{t("leadOnly")}</p>
      )}
    </div>
  );
}

export function CreateCampaignDialog({ institutions }: { institutions: { id: string; name: string }[] }) {
  const t = useTranslations("soc.campaigns");
  const ts = useTranslations("severity");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ tactic: "", institutionId: "__none", imitated: "", severity: "medium", summary: "" });
  const { pending, run } = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4" aria-hidden="true" />{t("new")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("new")}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createCampaign({ ...v, institutionId: v.institutionId === "__none" ? null : v.institutionId }); if (r.ok) { setOpen(false); router.push(`/soc/campaigns/${r.data.id}`); } return r; }, t("created")); }}>
          <div className="space-y-1.5"><Label htmlFor="nc-tactic">{t("tactic")}</Label><Input id="nc-tactic" required value={v.tactic} onChange={(e) => setV({ ...v, tactic: e.target.value })} placeholder="parking_fine" /></div>
          <div className="space-y-1.5"><Label htmlFor="nc-inst">{t("institution")}</Label>
            <Select value={v.institutionId} onValueChange={(x) => setV({ ...v, institutionId: x })}><SelectTrigger id="nc-inst" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">{t("noInstitution")}</SelectItem>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="nc-im">{t("imitated")}</Label><Input id="nc-im" value={v.imitated} onChange={(e) => setV({ ...v, imitated: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="nc-sev">{t("severity")}</Label>
            <Select value={v.severity} onValueChange={(x) => setV({ ...v, severity: x })}><SelectTrigger id="nc-sev" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{SEV.map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="nc-sum">{t("summaryLabel")}</Label><Textarea id="nc-sum" value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} rows={3} /></div>
          <DialogFooter><Button type="submit" disabled={pending || v.tactic.trim().length < 2}>{tu("create")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MergeDialog({ campaigns }: { campaigns: { id: string; code: string; imitated_name: string | null }[] }) {
  const t = useTranslations("soc.campaigns");
  const tu = useTranslations("ui");
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [dst, setDst] = useState("");
  const { pending, run } = useRun();
  const opts = campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.imitated_name ?? "—"}</SelectItem>);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><GitMerge className="size-4" aria-hidden="true" />{t("merge")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("merge")}</DialogTitle><DialogDescription>{t("mergeHint")}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>{t("code")}</Label><Select value={src} onValueChange={setSrc}><SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{opts}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>{t("mergeInto")}</Label><Select value={dst} onValueChange={setDst}><SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{opts}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button disabled={pending || !src || !dst || src === dst} onClick={() => run(() => mergeCampaigns({ sourceId: src, targetId: dst }), t("mergeDone"), () => setOpen(false))}>{tu("confirm")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MessagesSplit({ campaignId, messages }: { campaignId: string; messages: { id: string; body_masked: string; label: string; received_at: string | null }[] }) {
  const t = useTranslations("soc.campaign");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { pending, run } = useRun();
  if (!messages.length) return <p className="text-sm text-muted-foreground">{t("noMessages")}</p>;
  return (
    <div className="space-y-2">
      {sel.size > 0 && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const r = await splitCampaign({ campaignId, messageIds: [...sel] }); if (r.ok) toast.success(t("splitDone", { code: r.data.code })); setSel(new Set()); return r; })}>
          <Scissors className="size-4" aria-hidden="true" />{t("split")} ({sel.size})
        </Button>
      )}
      <ul className="max-h-[32rem] space-y-2 overflow-auto">
        {messages.map((m) => (
          <li key={m.id} className="flex gap-3 rounded-lg border border-border p-2.5 text-sm">
            <Checkbox aria-label={m.id.slice(0, 8)} checked={sel.has(m.id)} onCheckedChange={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(m.id); else n.delete(m.id); return n; })} />
            <p className="line-clamp-3 flex-1">{m.body_masked}</p>
            <span className="shrink-0 text-xs text-muted-foreground">{m.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreateTakedownForm({ campaignId, domains, confirmed }: { campaignId: string; domains: { id: string; domain: string }[]; confirmed: boolean }) {
  const t = useTranslations("soc.takedowns");
  const tk = useTranslations("noticeType");
  const [kinds, setKinds] = useState<Set<string>>(new Set(["registrar", "hosting", "akcesk"]));
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "__none");
  const { pending, run } = useRun();
  if (!confirmed) return <p className="text-sm text-muted-foreground">{t("notConfirmed")}</p>;
  return (
    <form className="glass-card space-y-3 rounded-xl p-4" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createTakedown({ campaignId, domainId: domainId === "__none" ? undefined : domainId, kinds: [...kinds] }); if (r.ok) toast.success(t("created", { count: r.data.ids.length })); return r; }); }}>
      <h3 className="inline-flex items-center gap-2 font-medium"><Gavel className="size-4" aria-hidden="true" />{t("create")}</h3>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 text-xs text-muted-foreground">{t("kinds")}</legend>
        {(["registrar", "hosting", "akcesk"] as const).map((k) => (
          <label key={k} className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={kinds.has(k)} onCheckedChange={(v) => setKinds((s) => { const n = new Set(s); if (v) n.add(k); else n.delete(k); return n; })} />{tk(k)}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{t("domainOptional")}</Label>
        <Select value={domainId} onValueChange={setDomainId}><SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="__none">—</SelectItem>{domains.map((d) => <SelectItem key={d.id} value={d.id}><span className="font-mono">{d.domain.replace(/\./g, "[.]")}</span></SelectItem>)}</SelectContent></Select>
      </div>
      <Button type="submit" disabled={pending || !kinds.size}>{t("create")}</Button>
    </form>
  );
}
