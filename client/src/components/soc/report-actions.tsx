"use client";

import { CheckCircle2, Copy as CopyIcon, Gavel, HelpCircle, Link2, Send, UserCheck, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addReportNote, assignReports, auditReveal, linkReportsToCampaign, setReportStatus } from "@/app/[locale]/soc/_actions/reports";
import { labelFeedback } from "@/app/[locale]/soc/_actions/intel";
import { IocTable, type IocRow } from "@/components/shared/ioc-table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import type { ReportStatus } from "@/server/queries/soc";

function useAct() {
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (success) toast.success(success);
        router.refresh();
      } else toast.error(r.error === "forbidden" ? tu("errorForbidden") : tu("errorGeneric"));
    });
  return { pending, run };
}

/** Decision bar (A3): Confirm scam, Not a scam, Need more info, Duplicate, Create takedown. */
export function DecisionBar({ id, status, campaignId, campaignConfirmed }: { id: string; status: ReportStatus; campaignId: string | null; campaignConfirmed: boolean }) {
  const t = useTranslations("soc.report");
  const ts = useTranslations("reportStatus");
  const { pending, run } = useAct();
  const set = (s: ReportStatus, note?: string) => run(() => setReportStatus({ ids: [id], status: s, note }), ts(s));
  return (
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t("decision")}>
      <Button size="sm" disabled={pending || status === "confirmed"} onClick={() => set("confirmed")} className="bg-flag-red text-white hover:bg-flag-red/90"><CheckCircle2 className="size-4" aria-hidden="true" />{t("confirm")}</Button>
      <Button size="sm" variant="outline" disabled={pending || status === "not_scam"} onClick={() => set("not_scam")}><XCircle className="size-4" aria-hidden="true" />{t("notScam")}</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => set("under_review", "need_more_info")}><HelpCircle className="size-4" aria-hidden="true" />{t("needInfo")}</Button>
      <Button size="sm" variant="outline" disabled={pending || status === "duplicate"} onClick={() => set("duplicate")}><CopyIcon className="size-4" aria-hidden="true" />{t("duplicate")}</Button>
      {campaignId && campaignConfirmed && (
        <Button size="sm" variant="secondary" asChild><Link href={`/soc/campaigns/${campaignId}?tab=takedowns`}><Gavel className="size-4" aria-hidden="true" />{t("createTakedown")}</Link></Button>
      )}
    </div>
  );
}

export function AssignMeButton({ id }: { id: string }) {
  const t = useTranslations("soc.report");
  const { pending, run } = useAct();
  return <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => assignReports({ ids: [id], assignee: "me" }))}><UserCheck className="size-4" aria-hidden="true" />{t("assignMe")}</Button>;
}

export function LinkSuggestion({ id, campaignId, code }: { id: string; campaignId: string; code: string }) {
  const t = useTranslations("soc.report");
  const { pending, run } = useAct();
  return <Button size="sm" disabled={pending} onClick={() => run(() => linkReportsToCampaign({ ids: [id], campaignId }), t("linked", { code }))}><Link2 className="size-4" aria-hidden="true" />{t("link")}</Button>;
}

export function NoteForm({ id, action = "report" }: { id: string; action?: "report" | "campaign" }) {
  const t = useTranslations("soc.report");
  const [body, setBody] = useState("");
  const { pending, run } = useAct();
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fn = action === "report" ? addReportNote : (await import("@/app/[locale]/soc/_actions/campaigns")).addCampaignNote;
        run(async () => {
          const r = await fn({ id, body });
          if (r.ok) setBody("");
          return r;
        });
      }}
    >
      <label htmlFor={`note-${id}`} className="sr-only">{t("addNote")}</label>
      <Textarea id={`note-${id}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("notePlaceholder")} rows={3} />
      <Button size="sm" type="submit" disabled={pending || !body.trim()}><Send className="size-4" aria-hidden="true" />{t("addNote")}</Button>
    </form>
  );
}

export function FeedbackButtons({ id }: { id: string }) {
  const t = useTranslations("soc.report");
  const tq = useTranslations("quiz");
  const { pending, run } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{t("feedback")}:</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => labelFeedback({ reportId: id, actual: "phishing" }), t("feedbackSaved"))}>{tq("scam")}</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => labelFeedback({ reportId: id, actual: "legitimate" }), t("feedbackSaved"))}>{tq("legit")}</Button>
    </div>
  );
}

/** IoC table whose Reveal is audited (SPEC 15.2). */
export function AuditedIocTable({ rows, filename }: { rows: IocRow[]; filename: string }) {
  return <IocTable rows={rows} filename={filename} onReveal={(r) => void auditReveal({ entity: r.type, value: r.value })} />;
}
