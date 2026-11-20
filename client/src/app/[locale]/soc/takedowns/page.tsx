import { CheckCheck, Clock, Download, FilePen, Gavel, Inbox, Info, Kanban, List, Send } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { SlaChip } from "@/components/soc/sla-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { fmtDateTime } from "@/lib/format";
import { nowMs } from "@/lib/time";
import { requireRole } from "@/server/auth";
import { getNotices, type NoticeRow } from "@/server/queries/soc";

const COLUMNS = ["draft", "in_review", "approved", "sent", "acknowledged", "taken_down", "no_response"] as const;
type Search = Promise<{ view?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("takedowns") };
}

function Card({ n, tk }: { n: NoticeRow; tk: (k: "registrar") => string }) {
  return (
    <Link href={`/soc/takedowns/${n.id}`} className="block space-y-2 rounded-xl border border-border bg-card p-3 text-xs shadow-xs transition-colors hover:border-primary/50">
      <div className="flex items-center justify-between gap-2"><span className="font-mono font-medium text-primary">{n.protocol}</span><Badge variant="secondary">{tk(n.kind as "registrar")}</Badge></div>
      <p className="font-mono text-muted-foreground">{(n.campaigns as { code: string } | null)?.code} · {(n.domains as { domain: string } | null)?.domain.replace(/\./g, "[.]") ?? "—"}</p>
      {n.status === "sent" && <SlaChip due={n.due_at} />}
    </Link>
  );
}

async function Stats() {
  const ctx = await requireRole("soc_analyst");
  const [notices, tx] = await Promise.all([getNotices(ctx.supabase), getTranslations("socx")]);
  const now = nowMs();
  const sent = notices.filter((n) => n.status === "sent");
  const stats = [
    { k: "open" as const, icon: FilePen, tone: "text-flag-yellow", v: notices.filter((n) => ["draft", "in_review", "approved"].includes(n.status)).length },
    { k: "waiting" as const, icon: Send, tone: "text-primary", v: sent.length },
    { k: "overdue" as const, icon: Clock, tone: "text-flag-red", v: sent.filter((n) => n.due_at && Date.parse(n.due_at) < now).length },
    { k: "done" as const, icon: CheckCheck, tone: "text-flag-green", v: notices.filter((n) => n.status === "taken_down").length },
  ];
  return <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map((x) => <li key={x.k}><StatCard icon={x.icon} tone={x.tone} label={tx(`td.${x.k}`)} value={x.v} /></li>)}</ul>;
}

async function Content({ searchParams }: { searchParams: Search }) {
  const { view = "board" } = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [t, tn, tk, ti, locale] = await Promise.all([getTranslations("soc.takedowns"), getTranslations("noticeStatus"), getTranslations("noticeType"), getTranslations("soc.inbox"), getLocale()]);
  const tabs = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
      {([["board", Kanban, t("board")], ["list", List, t("list")], ["outbox", Inbox, t("editor.outbox")]] as const).map(([v, Icon, label]) => (
        <Button key={v} asChild size="sm" variant={view === v ? "secondary" : "ghost"} className="rounded-full"><Link href={`/soc/takedowns?view=${v}`}><Icon className="size-4" aria-hidden="true" />{label}</Link></Button>
      ))}
      </div>
      <Button asChild size="sm" variant="outline" className="ml-auto rounded-full"><a href="/api/soc/export/takedowns"><Download className="size-3.5" aria-hidden="true" />CSV</a></Button>
    </div>
  );

  if (view === "outbox") {
    const { data } = await ctx.supabase.from("outbox").select("id, to_address, subject, body, kind, simulated, sent_at").order("sent_at", { ascending: false }).limit(100);
    return (
      <div className="space-y-4">
        {tabs}
        <p className="inline-flex items-center gap-2 rounded-xl border border-flag-yellow/40 bg-flag-yellow/5 px-3 py-2 text-sm"><Info className="size-4 text-flag-yellow" aria-hidden="true" />{t("editor.simulated")}</p>
        {!data?.length ? <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Gavel} title={t("empty")} /></div> : (
          <ul className="space-y-2">
            {data.map((m) => (
              <li key={m.id}>
                <details className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-medium">{m.subject}</span>
                    <span className="font-mono text-xs text-muted-foreground">→ {m.to_address}</span>
                    {m.simulated && <Badge variant="outline">simulated</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(m.sent_at, locale)}</span>
                  </summary>
                  <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{m.body}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const notices = await getNotices(ctx.supabase);
  if (!notices.length) return <div className="space-y-4">{tabs}<div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Gavel} title={t("empty")} /></div></div>;

  if (view === "list") {
    return (
      <div className="space-y-4">
        {tabs}
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
          <Table>
            <TableHeader><TableRow><TableHead>{ti("columns.protocol")}</TableHead><TableHead>{t("kind")}</TableHead><TableHead>{ti("columns.status")}</TableHead><TableHead className="hidden md:table-cell">{t("recipient")}</TableHead><TableHead className="hidden md:table-cell">{t("createdBy")}</TableHead><TableHead>{t("due")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-xs"><Link className="font-medium text-primary hover:underline" href={`/soc/takedowns/${n.id}`}>{n.protocol}</Link></TableCell>
                  <TableCell className="text-xs">{tk(n.kind)}</TableCell>
                  <TableCell><Badge variant="outline">{tn(n.status)}</Badge></TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{(n.recipients as { name: string } | null)?.name ?? "—"}</TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{(n.creator as { full_name: string | null } | null)?.full_name ?? "—"}</TableCell>
                  <TableCell>{n.status === "sent" ? <SlaChip due={n.due_at} /> : <span className="text-xs text-muted-foreground">{fmtDateTime(n.due_at, locale)}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tabs}
      <div className="flex gap-3 overflow-x-auto pb-2" role="list">
        {COLUMNS.map((col) => {
          const items = notices.filter((n) => n.status === col || (col === "no_response" && n.status === "rejected"));
          return (
            <section key={col} role="listitem" aria-label={tn(col)} className="min-h-48 min-w-64 flex-1 space-y-2 rounded-xl bg-muted/40 p-2.5">
              <h2 className="flex items-center justify-between px-1 pb-1 text-sm font-medium"><span>{tn(col)}</span><span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{items.length}</span></h2>
              {items.map((n) => <Card key={n.id} n={n} tk={tk} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default async function TakedownsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("takedowns")} subtitle={tx("pages.takedowns")}>
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>}><Stats /></Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
