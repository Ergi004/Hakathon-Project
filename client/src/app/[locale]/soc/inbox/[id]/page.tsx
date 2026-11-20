import { Lightbulb, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/layout/empty-state";
import { FlagBadge } from "@/components/flags/flag-badge";
import { ScoreRing } from "@/components/flags/score-ring";
import { MaskedText } from "@/components/shared/masked-text";
import { ReasonList } from "@/components/shared/reason-list";
import { AssignMeButton, AuditedIocTable, DecisionBar, FeedbackButtons, LinkSuggestion, NoteForm } from "@/components/soc/report-actions";
import { StaffIntel } from "@/components/intel/staff-intel";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { requireRole } from "@/server/auth";
import { supabaseCampaignRepo } from "@/server/campaign-repo";
import { assignCampaign } from "@/server/detection/campaigns";
import { hostOf } from "@/server/detection/normalize";
import type { Reason } from "@/server/detection/types";
import { latestScanState } from "@/server/intel/staff-view";
import { getReportDetail } from "@/server/queries/soc";
import { BackLink } from "@/components/layout/back-link";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, locale } = await params;
  return { title: `${(await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("inbox")} · ${id.slice(0, 8)}` };
}

async function Workspace({ params }: { params: Params }) {
  const { id } = await params;
  const t = await getTranslations("soc.report");
  const ts = await getTranslations("reportStatus");
  const tc = await getTranslations("channel");
  const te = await getTranslations("soc.events");
  const locale = await getLocale();
  if (!z.uuid().safeParse(id).success) return <EmptyState title={t("notFound")} />;
  const ctx = await requireRole("soc_analyst");
  const d = await getReportDetail(ctx.supabase, id);
  if (!d) return <EmptyState title={t("notFound")} />;
  const { report: r, message: m } = d;
  const reasons = (r.reasons as unknown as Reason[]) ?? [];
  const campaign = r.campaigns as { id: string; code: string; status: string; imitated_name: string | null } | null;
  const assignee = r.assignee as { id: string; full_name: string | null } | null;

  // Campaign suggestion (SPEC 6.4) as a dry run: never creates on page view.
  const suggestion = !campaign && m
    ? await assignCampaign(
        {
          iocs: (m.urls ?? []).flatMap((u) => [{ kind: "url" as const, value: u.replace(/\[\.\]/g, ".") }, ...(hostOf(u) ? [{ kind: "domain" as const, value: hostOf(u)! }] : [])]),
          bodyHash: m.body_hash,
          maskedBody: m.body_masked,
          institutionId: m.institution_id ?? undefined,
          tactic: m.tactic ?? undefined,
          seenAt: new Date(r.created_at),
        },
        supabaseCampaignRepo(ctx.supabase, { dryRun: true }),
      )
    : null;

  const notes = d.events.filter((e) => e.kind === "note");
  const timeline = d.events.filter((e) => e.kind !== "note");
  const intel = await latestScanState(ctx.supabase, r.id);
  const ti = await getTranslations("intel");
  const highlights = reasons.map((x) => x.evidence).filter((x): x is string => !!x && !x.includes("[."));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <ScoreRing score={r.score} flag={r.flag ?? "grey"} size="sm" />
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight md:text-3xl">{r.protocol}</h1>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {r.flag && <FlagBadge flag={r.flag} score={r.score} />}
              <Badge variant="outline">{ts(r.status)}</Badge>
              {r.channel && <Badge variant="secondary">{tc(r.channel)}</Badge>}
              {campaign && <Badge variant="outline" className="font-mono"><Link href={`/soc/campaigns/${campaign.id}`}>{campaign.code}</Link></Badge>}
            </div>
            <p className="pt-1 text-xs text-muted-foreground">{fmtDateTime(r.created_at, locale)} · {t("assignee")}: {assignee?.full_name ?? "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!assignee && <AssignMeButton id={r.id} />}
        </div>
      </div>

      <DecisionBar id={r.id} status={r.status} campaignId={campaign?.id ?? null} campaignConfirmed={!!campaign && ["confirmed", "takedown_in_progress"].includes(campaign.status)} />

      <UrlTabs defaultTab="workspace" tabs={[{ value: "workspace", label: ti("workspace"), content: (
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-display text-lg font-medium">{t("message")}</h2>
            {m ? (
              <>
                <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><dt className="inline">{t("sender")}: </dt><dd className="inline font-mono text-foreground">{m.sender_masked ?? "—"}</dd></div>
                  <div><dt className="inline">{t("reporter")}: </dt><dd className="inline text-foreground">{r.reporter_id ? "✓" : r.reporter_org_id ? `${t("org")}: ${(r.reporter_org as { name: string } | null)?.name ?? ""}` : t("anonymous")}{r.reporter_contact ? ` · ${t("contactHidden")}` : ""}</dd></div>
                </dl>
                <MaskedText text={m.body_masked} highlights={highlights} className="rounded-xl bg-muted/50 p-4 leading-relaxed" />
              </>
            ) : <p className="text-sm text-muted-foreground">{t("noMessage")}</p>}
            {d.extension && <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(d.extension.signals, null, 2)}</pre>}
          </section>

          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-display text-lg font-medium">{t("iocs")}</h2>
            <AuditedIocTable filename={`iocs-${r.protocol.replace("/", "-")}`} rows={[
              ...(m?.urls ?? []).map((u) => ({ type: "url", value: u, campaign: campaign?.code ?? null })),
              ...[...new Set((m?.urls ?? []).map((u) => hostOf(u)).filter((h): h is string => !!h))].map((h) => ({ type: "domain", value: h, campaign: campaign?.code ?? null })),
            ]} />
          </section>

          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-medium"><MessagesSquare className="size-4" aria-hidden="true" />{t("notes")}</h2>
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{(n.data as { body?: string }).body}</p>
                  <p className="pt-1 text-xs text-muted-foreground">{(n.actor as { full_name: string | null } | null)?.full_name ?? "—"} · {fmtAgo(n.created_at, locale)}</p>
                </li>
              ))}
            </ul>
            <NoteForm id={r.id} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-display text-lg font-medium">{t("reasons")}</h2>
            <ReasonList reasons={reasons} initial={8} showWeights />
          </section>

          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-medium"><Lightbulb className="size-4 text-flag-yellow" aria-hidden="true" />{t("suggestion")}</h2>
            {campaign ? (
              <p className="text-sm">{t("linked", { code: campaign.code })}</p>
            ) : suggestion?.code && suggestion.id ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm">{suggestion.code}</p>
                  <p className="text-xs text-muted-foreground">{t(`matchType.${suggestion.matchType}`)} · {t("confidence", { value: Math.round(suggestion.confidence * 100) })}</p>
                </div>
                <LinkSuggestion id={r.id} campaignId={suggestion.id} code={suggestion.code} />
              </div>
            ) : suggestion?.matchType === "new_candidate" ? (
              <p className="text-sm">{t("matchType.new_candidate")}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noSuggestion")}</p>
            )}
          </section>

          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-display text-lg font-medium">{t("similar")}</h2>
            {d.similar.length ? (
              <ul className="space-y-2">
                {d.similar.map((s) => (
                  <li key={s.id} className="rounded-xl bg-muted/40 p-3 text-xs">
                    <p className="line-clamp-2">{s.body_masked}</p>
                    <p className="pt-1 text-muted-foreground">{Math.round(s.similarity * 100)}% · {fmtAgo(s.created_at, locale)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">{t("noSimilar")}</p>}
          </section>

          <section className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="font-display text-lg font-medium">{t("timeline")}</h2>
            <ol className="space-y-1.5 text-sm">
              {timeline.map((e) => (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>{te(e.kind as "created")}{(e.data as { to?: string }).to ? `: ${ts((e.data as { to: "received" }).to)}` : ""}{(e.actor as { full_name: string | null } | null)?.full_name ? ` · ${(e.actor as { full_name: string }).full_name}` : ""}</span>
                  <time className="shrink-0 text-xs text-muted-foreground">{fmtAgo(e.created_at, locale)}</time>
                </li>
              ))}
            </ol>
            <FeedbackButtons id={r.id} />
          </section>
        </div>
      </div>
      ) }, { value: "intel", label: ti("tab"), content: (
        <StaffIntel reportId={r.id} state={intel?.state ?? null} domain={intel?.domain ?? null} campaignId={campaign?.id ?? null} hasUrl={(m?.urls ?? []).length > 0} />
      ) }]} />
    </div>
  );
}

export default function ReportWorkspacePage({ params }: { params: Params }) {
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-4">
      <BackLink href="/soc/inbox" namespace="soc.report" label="back" />
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-16 w-80" /><Skeleton className="h-96 w-full" /></div>}>
        <Workspace params={params} />
      </Suspense>
    </div>
  );
}
