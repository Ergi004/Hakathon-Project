import { Download, Inbox, Kanban, List } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SlaChip } from "@/components/soc/sla-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { fmtDateTime } from "@/lib/format";
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
    <Link href={`/soc/takedowns/${n.id}`} className="block space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs hover:border-primary/50">
      <div className="flex items-center justify-between gap-2"><span className="font-mono">{n.protocol}</span><Badge variant="secondary">{tk(n.kind as "registrar")}</Badge></div>
      <p className="font-mono text-muted-foreground">{(n.campaigns as { code: string } | null)?.code} · {(n.domains as { domain: string } | null)?.domain.replace(/\./g, "[.]") ?? "—"}</p>
      {n.status === "sent" && <SlaChip due={n.due_at} />}
    </Link>
  );
}

async function Content({ searchParams }: { searchParams: Search }) {
  const { view = "board" } = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [t, tn, tk, ti, locale] = await Promise.all([getTranslations("soc.takedowns"), getTranslations("noticeStatus"), getTranslations("noticeType"), getTranslations("soc.inbox"), getLocale()]);
  const tabs = (
    <div className="flex flex-wrap gap-1">
      {([["board", Kanban, t("board")], ["list", List, t("list")], ["outbox", Inbox, t("editor.outbox")]] as const).map(([v, Icon, label]) => (
        <Button key={v} asChild size="sm" variant={view === v ? "secondary" : "ghost"}><Link href={`/soc/takedowns?view=${v}`}><Icon className="size-4" aria-hidden="true" />{label}</Link></Button>
      ))}
      <Button asChild size="sm" variant="outline" className="ml-auto"><a href="/api/soc/export/takedowns"><Download className="size-3.5" aria-hidden="true" />CSV</a></Button>
    </div>
  );

  if (view === "outbox") {
    const { data } = await ctx.supabase.from("outbox").select("id, to_address, subject, body, kind, simulated, sent_at").order("sent_at", { ascending: false }).limit(100);
    return (
      <div className="space-y-4">
        {tabs}
        <p className="text-sm text-muted-foreground">{t("editor.simulated")}</p>
        {!data?.length ? <EmptyState title={t("empty")} /> : (
          <ul className="space-y-2">
            {data.map((m) => (
              <li key={m.id}>
                <details className="rounded-lg border border-border p-3 text-sm">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-medium">{m.subject}</span>
                    <span className="font-mono text-xs text-muted-foreground">→ {m.to_address}</span>
                    {m.simulated && <Badge variant="outline">simulated</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(m.sent_at, locale)}</span>
                  </summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{m.body}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const notices = await getNotices(ctx.supabase);
  if (!notices.length) return <div className="space-y-4">{tabs}<EmptyState title={t("empty")} /></div>;

  if (view === "list") {
    return (
      <div className="space-y-4">
        {tabs}
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader><TableRow><TableHead>{ti("columns.protocol")}</TableHead><TableHead>{t("kind")}</TableHead><TableHead>{ti("columns.status")}</TableHead><TableHead className="hidden md:table-cell">{t("recipient")}</TableHead><TableHead className="hidden md:table-cell">{t("createdBy")}</TableHead><TableHead>{t("due")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-xs"><Link className="hover:underline" href={`/soc/takedowns/${n.id}`}>{n.protocol}</Link></TableCell>
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
            <section key={col} role="listitem" aria-label={tn(col)} className="w-64 shrink-0 space-y-2 rounded-xl bg-muted/40 p-2">
              <h2 className="flex items-center justify-between px-1 text-xs font-medium"><span>{tn(col)}</span><span className="text-muted-foreground">{items.length}</span></h2>
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
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("takedowns")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content searchParams={searchParams} /></Suspense>
    </div>
  );
}
