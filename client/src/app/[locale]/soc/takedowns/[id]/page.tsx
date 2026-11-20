import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { NoticeEditor, NoticePreview } from "@/components/soc/notice-editor";
import { SlaChip } from "@/components/soc/sla-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { fmtDateTime } from "@/lib/format";
import { hasMinRole, requireRole } from "@/server/auth";
import { defang } from "@/server/detection/normalize";
import { getNoticeDetail } from "@/server/queries/soc";
import { buildNotice } from "@/server/takedown/fill";

type Params = Promise<{ locale: string; id: string }>;
const FLOW = ["draft", "in_review", "approved", "sent", "acknowledged", "taken_down"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("takedowns") };
}

async function Editor({ params }: { params: Params }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return <EmptyState title="404" />;
  const ctx = await requireRole("soc_analyst");
  const [d, t, tn, tk, te, locale] = await Promise.all([getNoticeDetail(ctx.supabase, id), getTranslations("soc.takedowns"), getTranslations("noticeStatus"), getTranslations("noticeType"), getTranslations("soc.noticeEvents"), getLocale()]);
  if (!d) return <EmptyState title={t("empty")} />;
  const n = d.notice;
  const campaign = n.campaigns as { id: string; code: string; status: string; imitated_name: string | null } | null;
  const domain = n.domains as { id: string; domain: string; registrar: string | null; hosting_country: string | null } | null;
  const creator = n.creator as { id: string; full_name: string | null } | null;
  const approver = n.approver as { full_name: string | null } | null;
  const locked = [n.protocol, domain ? defang(domain.domain) : "", campaign?.code ?? ""];

  // Other-language version, rendered from the template (read-only).
  const bodyIsSq = /Përshëndetje|Me respekt/.test(n.body);
  let other: { subject: string; body: string } | null = null;
  if (campaign) {
    try {
      other = await buildNotice(ctx.supabase, n.kind, bodyIsSq ? "en" : "sq", { protocol: n.protocol, campaign: { id: campaign.id, code: campaign.code, imitated_name: campaign.imitated_name, first_seen: null }, domain, analystName: creator?.full_name ?? "SOC" });
    } catch {
      other = null;
    }
  }
  const idx = FLOW.indexOf(n.status as (typeof FLOW)[number]);

  return (
    <div className="space-y-6">
      <header className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h1 className="font-mono text-2xl font-bold tracking-tight md:text-3xl">{n.protocol}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tk(n.kind)}</Badge>
          <Badge variant="outline">{tn(n.status)}</Badge>
          {n.status === "sent" && <SlaChip due={n.due_at} />}
          {campaign && <Badge variant="outline" className="font-mono"><Link href={`/soc/campaigns/${campaign.id}?tab=takedowns`}>{campaign.code}</Link></Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{t("createdBy")}: {creator?.full_name ?? "—"}{approver ? ` · ${t("approvedBy")}: ${approver.full_name}` : ""}</p>
        <StatusTimeline orientation="horizontal" steps={FLOW.map((s, i) => ({ key: s, label: tn(s), state: idx === -1 ? "pending" : i < idx ? "done" : i === idx ? "current" : "pending" }))} />
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <NoticeEditor
          id={n.id}
          status={n.status}
          subject={n.subject}
          body={n.body}
          isCreator={creator?.id === ctx.user.id}
          isLead={hasMinRole(ctx.profile.platform_role, "soc_lead")}
          hasEvidence={!!n.evidence_path}
          recipientId={n.recipient_id}
          recipients={d.recipients}
          locked={locked}
        />
        <div className="space-y-6">
          {other && <NoticePreview subject={other.subject} body={other.body} locked={locked} label={t("editor.otherLocale")} />}
          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-display text-lg font-medium">{t("editor.events")}</h2>
            <ol className="space-y-1.5 text-sm">
              {d.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{te.has(e.kind as "created") ? te(e.kind as "created") : e.kind}{e.note ? ` · ${e.note}` : ""}{(e.actor as { full_name: string | null } | null)?.full_name ? ` · ${(e.actor as { full_name: string }).full_name}` : ""}</span>
                  <time className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.created_at, locale)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function NoticePage({ params }: { params: Params }) {
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-4">
      <Suspense fallback={null}><Back /></Suspense>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}><Editor params={params} /></Suspense>
    </div>
  );
}
async function Back() {
  const t = await getTranslations("soc.nav");
  return <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/soc/takedowns"><ArrowLeft className="size-4" aria-hidden="true" />{t("takedowns")}</Link></Button>;
}
