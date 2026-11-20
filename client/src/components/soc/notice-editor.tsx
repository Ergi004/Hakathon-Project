"use client";

import { CheckCircle2, FileDown, Lock, Save, Send, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveAndSend, evidenceUrl, logReply, rejectNotice, setNoticeRecipient, submitForReview, updateNoticeDraft } from "@/app/[locale]/soc/takedowns/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";

/** Highlights locked values (protocol, domain, IoCs) inside a notice (SPEC 3 NoticePreview). */
function Highlighted({ text, locked }: { text: string; locked: string[] }) {
  const parts = locked.filter(Boolean).map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!parts.length) return <>{text}</>;
  const re = new RegExp(`(${parts.join("|")})`, "g");
  return (
    <>
      {text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-primary/15 px-0.5 font-mono text-foreground">{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

export function NoticePreview({ subject, body, locked, label }: { subject: string; body: string; locked: string[]; label: string }) {
  return (
    <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10" aria-label={label}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium"><Highlighted text={subject} locked={locked} /></p>
      <div className="max-h-[32rem] overflow-auto text-sm whitespace-pre-wrap"><Highlighted text={body} locked={locked} /></div>
    </section>
  );
}

export function NoticeEditor({
  id, status, subject, body, isCreator, isLead, hasEvidence, recipientId, recipients, locked,
}: {
  id: string; status: string; subject: string; body: string; isCreator: boolean; isLead: boolean; hasEvidence: boolean;
  recipientId: string | null; recipients: { id: string; name: string; abuse_email: string }[]; locked: string[];
}) {
  const t = useTranslations("soc.takedowns.editor");
  const tu = useTranslations("ui");
  const tt = useTranslations("soc.takedowns");
  const tns = useTranslations("noticeStatus");
  const router = useRouter();
  const [s, setS] = useState(subject);
  const [b, setB] = useState(body);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"acknowledged" | "taken_down" | "rejected">("acknowledged");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const editable = isCreator && (status === "draft" || status === "in_review");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, ok = tu("saved")) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast.success(ok); router.refresh(); }
      else toast.error(r.message === "four-eyes" ? t("fourEyes") : r.error === "forbidden" ? tu("errorForbidden") : tu("errorGeneric"));
    });

  return (
    <div className="space-y-4">
      <Alert><Lock className="size-4" /><AlertDescription>{t("locked")} {t("simulated")}</AlertDescription></Alert>
      <div className="space-y-1.5">
        <Label htmlFor="n-recipient">{tt("recipient")}</Label>
        <Select value={recipientId ?? ""} onValueChange={(v) => run(() => setNoticeRecipient({ id, recipientId: v }))} disabled={!editable || pending}>
          <SelectTrigger id="n-recipient" className="w-full sm:w-96"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{recipients.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · <span className="font-mono">{r.abuse_email}</span></SelectItem>)}</SelectContent>
        </Select>
      </div>
      {editable ? (
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="n-subject">{t("subject")}</Label><Input id="n-subject" value={s} onChange={(e) => setS(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="n-body">{t("body")}</Label><Textarea id="n-body" value={b} onChange={(e) => setB(e.target.value)} rows={18} className="font-mono text-xs" /></div>
        </div>
      ) : (
        <NoticePreview subject={s} body={b} locked={locked} label={t("preview")} />
      )}
      <div className="flex flex-wrap gap-2">
        {editable && <Button variant="outline" disabled={pending} onClick={() => run(() => updateNoticeDraft({ id, subject: s, body: b }))}><Save className="size-4" aria-hidden="true" />{t("save")}</Button>}
        {isCreator && status === "draft" && <Button disabled={pending} onClick={() => run(async () => { const r = await updateNoticeDraft({ id, subject: s, body: b }); return r.ok ? submitForReview({ id }) : r; })}><Send className="size-4" aria-hidden="true" />{t("submit")}</Button>}
        {isLead && status === "in_review" && !isCreator && <Button disabled={pending} onClick={() => run(() => approveAndSend({ id }))} className="bg-flag-green text-white hover:bg-flag-green/90"><CheckCircle2 className="size-4" aria-hidden="true" />{t("approve")}</Button>}
        {hasEvidence && <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await evidenceUrl({ id }); if (r.ok) window.open(r.data.url, "_blank", "noopener"); else toast.error(tu("errorGeneric")); })}><FileDown className="size-4" aria-hidden="true" />{t("evidence")}</Button>}
      </div>
      {status === "in_review" && isCreator && isLead && <p className="text-sm text-muted-foreground">{t("fourEyes")}</p>}
      {isLead && status === "in_review" && !isCreator && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5"><Label htmlFor="n-reason">{t("rejectReason")}</Label><Input id="n-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button variant="outline" disabled={pending || reason.trim().length < 3} onClick={() => run(() => rejectNotice({ id, reason }))}><Undo2 className="size-4" aria-hidden="true" />{t("reject")}</Button>
        </div>
      )}
      {["sent", "acknowledged", "no_response"].includes(status) && (
        <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <div className="space-y-1.5"><Label htmlFor="n-outcome">{t("outcome")}</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}><SelectTrigger id="n-outcome" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{(["acknowledged", "taken_down", "rejected"] as const).map((o) => <SelectItem key={o} value={o}>{tns(o)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="n-note">{t("note")}</Label><Input id="n-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Button disabled={pending} onClick={() => run(() => logReply({ id, outcome, note: note || undefined }))}>{t("logReply")}</Button>
        </div>
      )}
    </div>
  );
}
