"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addBlocklistEntry, removeBlocklistEntry } from "@/app/[locale]/soc/_actions/intel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

const TYPES = ["domain", "url", "phone", "email", "ip"] as const;

export function BlocklistForm() {
  const t = useTranslations("soc.blocklist");
  const ti = useTranslations("ioc.types");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [v, setV] = useState({ type: "domain", value: "", reason: "", expiresAt: "" });
  const [pending, start] = useTransition();
  return (
    <form className="glass-card grid gap-3 rounded-xl p-4 md:grid-cols-[9rem_1fr_1fr_10rem_auto] md:items-end" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await addBlocklistEntry({ ...v, expiresAt: v.expiresAt || undefined, reason: v.reason || undefined });
        if (r.ok) { toast.success(t("added")); setV({ type: v.type, value: "", reason: "", expiresAt: "" }); router.refresh(); } else toast.error(tu("errorInvalid"));
      });
    }}>
      <div className="space-y-1.5"><Label htmlFor="bl-type">{t("type")}</Label>
        <Select value={v.type} onValueChange={(x) => setV({ ...v, type: x })}><SelectTrigger id="bl-type" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((x) => <SelectItem key={x} value={x}>{ti(x)}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="bl-value">{t("value")}</Label><Input id="bl-value" required value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} /></div>
      <div className="space-y-1.5"><Label htmlFor="bl-reason">{t("reason")}</Label><Input id="bl-reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="bl-exp">{t("expires")}</Label><Input id="bl-exp" type="date" value={v.expiresAt} onChange={(e) => setV({ ...v, expiresAt: e.target.value })} /></div>
      <Button type="submit" disabled={pending || v.value.trim().length < 3}><Plus className="size-4" aria-hidden="true" />{t("add")}</Button>
    </form>
  );
}

export function RemoveBlocklistButton({ id, label }: { id: string; label: string }) {
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="icon" className="size-8" aria-label={`${tu("remove")}: ${label}`} disabled={pending} onClick={() => start(async () => { const r = await removeBlocklistEntry({ id }); if (r.ok) router.refresh(); else toast.error(tu("errorGeneric")); })}>
      <Trash2 className="size-4" />
    </Button>
  );
}
