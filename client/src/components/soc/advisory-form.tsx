"use client";

import { Megaphone, Send, Wand2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAdvisory, setAdvisoryStatus } from "@/app/[locale]/soc/_actions/intel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";

type Camp = { id: string; code: string; imitated_name: string | null; tactic: string };

/** A11: draft bilingual public warnings from a campaign with a template. */
export function AdvisoryForm({ campaigns, initialCampaign, initialRegion }: { campaigns: Camp[]; initialCampaign?: string; initialRegion?: { sq: string; en: string } }) {
  const t = useTranslations("soc.advisories");
  const ts = useTranslations("severity");
  const tu = useTranslations("ui");
  const tcmp = useTranslations("soc.campaign");
  const router = useRouter();
  const tg = useTranslations("geo.advisory");
  const [v, setV] = useState({
    campaignId: initialCampaign ?? "__none",
    // "Create advisory for this area" (geographic map) prefills the region in both languages.
    title_sq: initialRegion ? tg("titleSq", { name: initialRegion.sq }) : "",
    title_en: initialRegion ? tg("titleEn", { name: initialRegion.en }) : "",
    body_sq: initialRegion ? tg("bodySq", { name: initialRegion.sq }) : "",
    body_en: initialRegion ? tg("bodyEn", { name: initialRegion.en }) : "",
    severity: "medium",
  });
  const [pending, start] = useTransition();

  function fromTemplate() {
    const c = campaigns.find((x) => x.id === v.campaignId);
    if (!c) return;
    const name = c.imitated_name ?? c.code;
    setV({
      ...v,
      title_sq: `Kujdes: mesazhe të rreme në emër të ${name}`,
      title_en: `Warning: fake messages in the name of ${name}`,
      body_sq: `Po qarkullojnë mesazhe të rreme që imitojnë ${name} (fushata ${c.code}, taktika: ${c.tactic.replace(/_/g, " ")}).\n\nMos klikoni lidhjet, mos paguani dhe mos jepni të dhëna personale ose të kartës. Kontrolloni çdo mesazh në Mburoja dhe raportojeni.\n\nNëse keni paguar ose keni dhënë të dhëna, telefononi menjëherë bankën tuaj.`,
      body_en: `Fake messages imitating ${name} are circulating (campaign ${c.code}, tactic: ${c.tactic.replace(/_/g, " ")}).\n\nDo not click links, do not pay and do not share personal or card details. Check any message on Mburoja and report it.\n\nIf you paid or shared details, call your bank right away.`,
    });
  }

  return (
    <form
      className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveAdvisory({ ...v, campaignId: v.campaignId === "__none" ? null : v.campaignId });
          if (r.ok) { toast.success(tu("saved")); setV({ campaignId: "__none", title_sq: "", title_en: "", body_sq: "", body_en: "", severity: "medium" }); router.refresh(); }
          else toast.error(tu("errorInvalid"));
        });
      }}
    >
      <h2 className="inline-flex items-center gap-2 font-display text-lg font-medium"><Megaphone className="size-5 text-primary" aria-hidden="true" />{t("new")}</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5"><Label htmlFor="adv-c">{t("fromCampaign")}</Label>
          <Select value={v.campaignId} onValueChange={(x) => setV({ ...v, campaignId: x })}><SelectTrigger id="adv-c" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__none">—</SelectItem>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.imitated_name ?? ""}</SelectItem>)}</SelectContent></Select></div>
        <Button type="button" variant="outline" disabled={v.campaignId === "__none"} onClick={fromTemplate}><Wand2 className="size-4" aria-hidden="true" />{t("template")}</Button>
        <div className="space-y-1.5"><Label htmlFor="adv-s">{tcmp("severity")}</Label>
          <Select value={v.severity} onValueChange={(x) => setV({ ...v, severity: x })}><SelectTrigger id="adv-s" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{(["low", "medium", "high", "critical"] as const).map((s) => <SelectItem key={s} value={s}>{ts(s)}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="adv-ts">{t("titleSq")}</Label><Input id="adv-ts" lang="sq" value={v.title_sq} onChange={(e) => setV({ ...v, title_sq: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="adv-bs">{t("bodySq")}</Label><Textarea id="adv-bs" lang="sq" rows={7} value={v.body_sq} onChange={(e) => setV({ ...v, body_sq: e.target.value })} /></div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="adv-te">{t("titleEn")}</Label><Input id="adv-te" lang="en" value={v.title_en} onChange={(e) => setV({ ...v, title_en: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="adv-be">{t("bodyEn")}</Label><Textarea id="adv-be" lang="en" rows={7} value={v.body_en} onChange={(e) => setV({ ...v, body_en: e.target.value })} /></div>
        </div>
      </div>
      <Button type="submit" disabled={pending}>{tu("save")}</Button>
    </form>
  );
}

export function AdvisoryStatusButtons({ id, status, isLead, isCreator }: { id: string; status: string; isLead: boolean; isCreator: boolean }) {
  const t = useTranslations("soc.advisories");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: "draft" | "in_review" | "published") => start(async () => {
    const r = await setAdvisoryStatus({ id, status: s });
    if (r.ok) { toast.success(t(`statuses.${s}`)); router.refresh(); }
    else toast.error(r.error === "forbidden" || r.message === "four-eyes" ? tu("errorForbidden") : tu("errorGeneric"));
  });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && <Button size="sm" variant="outline" disabled={pending} onClick={() => set("in_review")}><Send className="size-4" aria-hidden="true" />{t("submit")}</Button>}
      {status === "in_review" && isLead && !isCreator && <Button size="sm" disabled={pending} onClick={() => set("published")}>{t("publish")}</Button>}
      {status === "published" && isLead && <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("draft")}>{t("unpublish")}</Button>}
    </div>
  );
}
