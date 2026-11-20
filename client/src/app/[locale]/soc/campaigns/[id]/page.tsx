import { ArrowLeft, Download, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { EmptyState } from "@/components/layout/empty-state";
import { DefangedText } from "@/components/shared/defanged-text";
import { SeverityDot } from "@/components/shared/severity-dot";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { UrlTabs } from "@/components/shared/url-tabs";
import { CampaignControls, CreateTakedownForm, MessagesSplit } from "@/components/soc/campaign-controls";
import { AuditedIocTable, NoteForm } from "@/components/soc/report-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { fmtAgo, fmtDate } from "@/lib/format";
import { asBrandCategory, asScamType } from "@/lib/pattern-labels";
import { hasMinRole, requireRole } from "@/server/auth";
import { getCampaignDetail, getCampaignPattern, getStaff } from "@/server/queries/soc";

type Params = Promise<{ locale: string; id: string }>;

/** Auth + campaign data are request-time; allow blocking navigations under Cache Components. */
export const instant = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("campaigns") };
}

async function Workspace({ params }: { params: Params }) {
  const { id } = await params;
  const t = await getTranslations("soc.campaign");
  const tScam = await getTranslations("scamType");
  const tBrand = await getTranslations("brandCategory");
  const tSignal = await getTranslations("signalCode");
  const tc = await getTranslations("campaignStatus");
  const tn = await getTranslations("noticeStatus");
  const tk = await getTranslations("noticeType");
  const tdc = await getTranslations("domainClass");
  const tds = await getTranslations("soc.domains");
  const locale = await getLocale();
  if (!z.uuid().safeParse(id).success) return <EmptyState title="404" />;
  const ctx = await requireRole("soc_analyst");
  const [d, staff, pattern] = await Promise.all([getCampaignDetail(ctx.supabase, id), getStaff(ctx.supabase), getCampaignPattern(ctx.supabase, id)]);
  if (!d) return <EmptyState title="404" />;
  const c = d.campaign;
  const isLead = hasMinRole(ctx.profile.platform_role, "soc_lead");
  const order = ["monitoring", "confirmed", "takedown_in_progress", "resolved"] as const;
  const idx = order.indexOf(c.status);

  const scamKey = asScamType(pattern?.scamType);
  const brandKey = asBrandCategory(pattern?.brand);
  const patternSection = (
    <section className="glass-card space-y-3 rounded-xl p-4">
      <h3 className="font-medium">{t("patternTitle")}</h3>
      {pattern ? (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">{t("scamType")}</dt><dd className="text-sm">{scamKey ? tScam(scamKey) : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("brand")}</dt><dd className="text-sm">{brandKey ? tBrand(brandKey) : "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("patternSize")}</dt><dd className="text-sm tabular-nums">{pattern.size}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("confidence")}</dt><dd className="text-sm tabular-nums">{pattern.confidence === null ? "—" : t("confidenceValue", { value: Math.round(pattern.confidence * 100) })}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("firstSeen")}</dt><dd className="text-sm">{fmtDate(pattern.firstSeen, locale)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("lastSeen")}</dt><dd className="text-sm">{fmtDate(pattern.lastSeen, locale)}</dd></div>
            {pattern.hostingCountry && <div><dt className="text-xs text-muted-foreground">{t("hostingCountry")}</dt><dd className="text-sm">{pattern.hostingCountry}</dd></div>}
            {pattern.claimedPlace && <div><dt className="text-xs text-muted-foreground">{t("claimedPlace")}</dt><dd className="text-sm">{pattern.claimedPlace}</dd></div>}
          </dl>
          {pattern.matchedSignals.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("signal")}</TableHead>
                    <TableHead className="text-right">{t("weight")}</TableHead>
                    <TableHead>{t("evidence")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pattern.matchedSignals.map((signal, index) => (
                    <TableRow key={`${signal.code}-${index}`}>
                      <TableCell className="text-xs">{tSignal(signal.code)}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{signal.weight}</TableCell>
                      <TableCell className="text-xs">{signal.evidence ? <DefangedText value={signal.evidence} /> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("noSignals")}</p>}
        </>
      ) : <p className="text-sm text-muted-foreground">{t("noPattern")}</p>}
    </section>
  );

  const overview = (
    <div className="space-y-5">
      {patternSection}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[[t("reports"), d.reportCount], [t("domainsCount"), d.domains.length], ["IoC", d.iocs.length], [t("notices"), d.notices.length]].map(([k, v]) => (
          <div key={String(k)} className="glass-card rounded-xl p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-display text-2xl font-bold">{v}</dd></div>
        ))}
      </dl>
      {d.weekly.length > 1 && (
        <section className="glass-card space-y-2 rounded-xl p-4">
          <h3 className="font-medium">{t("timeline")}</h3>
          <WeeklyBars data={d.weekly.map((w) => ({ week: fmtDate(w.week, locale, "d MMM"), count: w.count }))} label={t("timeline")} summary={d.weekly.map((w) => `${w.week}: ${w.count}`).join("; ")} />
        </section>
      )}
      {c.summary && <p className="text-sm whitespace-pre-wrap">{c.summary}</p>}
    </div>
  );

  const domainsTab = (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>{tds("domain")}</TableHead><TableHead>{tds("class")}</TableHead><TableHead className="hidden md:table-cell">{tds("registrar")}</TableHead><TableHead className="hidden md:table-cell">{tds("age")}</TableHead><TableHead>{tds("status")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {d.domains.map((x) => (
              <TableRow key={x.id}>
                <TableCell><DefangedText value={x.domain} /></TableCell>
                <TableCell className="text-xs">{tdc(x.class)}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{x.registrar ?? "—"}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{x.age_days !== null ? tds("ageDays", { count: x.age_days }) : "—"}</TableCell>
                <TableCell><Badge variant="outline">{tds(`statuses.${x.status as "threat"}`)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <AuditedIocTable filename={`iocs-${c.code}`} rows={d.iocs.map((i) => ({ type: i.type, value: i.value, campaign: c.code, first_seen: i.first_seen }))} />
    </div>
  );

  const takedownsTab = (
    <div className="space-y-4">
      <CreateTakedownForm campaignId={c.id} confirmed={["confirmed", "takedown_in_progress"].includes(c.status)} domains={d.domains.map((x) => ({ id: x.id, domain: x.domain }))} />
      {d.notices.length ? (
        <ul className="space-y-2">
          {d.notices.map((n) => (
            <li key={n.id}>
              <Link href={`/soc/takedowns/${n.id}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent">
                <span className="font-mono text-xs">{n.protocol}</span>
                <Badge variant="secondary">{tk(n.kind)}</Badge>
                <Badge variant="outline">{tn(n.status)}</Badge>
                {n.domains && <span className="font-mono text-xs">{(n.domains as { domain: string }).domain.replace(/\./g, "[.]")}</span>}
                {n.due_at && <span className="ml-auto text-xs text-muted-foreground">{fmtAgo(n.due_at, locale)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{t("noNotices")}</p>}
    </div>
  );

  const notesTab = (
    <div className="space-y-3">
      <NoteForm id={c.id} action="campaign" />
      <ul className="space-y-2">
        {d.notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="pt-1 text-xs text-muted-foreground">{(n.author as { full_name: string | null } | null)?.full_name ?? "—"} · {fmtAgo(n.created_at, locale)}</p>
          </li>
        ))}
      </ul>
    </div>
  );

  const advisoryTab = (
    <div className="space-y-3">
      <Button asChild variant="outline"><Link href={`/soc/advisories?campaign=${c.id}`}><Megaphone className="size-4" aria-hidden="true" />{t("createAdvisory")}</Link></Button>
      <ul className="space-y-2">
        {d.advisories.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <span>{locale === "en" ? a.title_en : a.title_sq}</span><Badge variant="outline">{a.status}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{c.code}</span>
          {c.is_public && <Badge>{t("publishedNote")}</Badge>}
          <SeverityDot severity={c.severity} />
        </div>
        <h1 className="font-display text-2xl font-bold">{(c.institutions as { name: string } | null)?.name ?? c.imitated_name ?? c.code} · <span className="text-muted-foreground">{c.tactic.replace(/_/g, " ")}</span></h1>
        <StatusTimeline orientation="horizontal" steps={order.map((s, i) => ({ key: s, label: tc(s), state: i < idx ? "done" : i === idx ? "current" : "pending" }))} />
      </header>
      <CampaignControls id={c.id} status={c.status} severity={c.severity} ownerId={c.owner_id} isPublic={c.is_public} isLead={isLead} staff={staff} />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><a href={`/api/v1/export/iocs?format=csv&campaign=${encodeURIComponent(c.code)}`}><Download className="size-3.5" aria-hidden="true" />{t("exportCsv")}</a></Button>
        <Button asChild variant="outline" size="sm"><a href={`/api/v1/export/iocs?format=json&campaign=${encodeURIComponent(c.code)}`}><Download className="size-3.5" aria-hidden="true" />{t("exportStix")}</a></Button>
      </div>
      <UrlTabs defaultTab="overview" tabs={[
        { value: "overview", label: t("tabs.overview"), content: overview },
        { value: "messages", label: `${t("tabs.messages")} (${d.messages.length})`, content: <MessagesSplit campaignId={c.id} messages={d.messages} /> },
        { value: "domains", label: t("tabs.domains"), content: domainsTab },
        { value: "takedowns", label: t("tabs.takedowns"), content: takedownsTab },
        { value: "notes", label: t("tabs.notes"), content: notesTab },
        { value: "advisory", label: t("tabs.advisory"), content: advisoryTab },
      ]} />
    </div>
  );
}

export default function CampaignWorkspacePage({ params }: { params: Params }) {
  return (
    <div className="space-y-4">
      <Suspense fallback={null}><Back /></Suspense>
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></div>}><Workspace params={params} /></Suspense>
    </div>
  );
}
async function Back() {
  const t = await getTranslations("soc.nav");
  return <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/soc/campaigns"><ArrowLeft className="size-4" aria-hidden="true" />{t("campaigns")}</Link></Button>;
}
