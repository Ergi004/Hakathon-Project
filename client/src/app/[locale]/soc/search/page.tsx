import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Search, SearchX } from "lucide-react";
import { DashPage, EmptyPanel, Panel } from "@/components/layout/dash";
import { FlagBadge } from "@/components/flags/flag-badge";
import { MaskedText } from "@/components/shared/masked-text";
import { UrlSearch } from "@/components/shared/url-search";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/server/auth";
import { globalSearch } from "@/server/queries/soc";

type Search = Promise<{ q?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("search") };
}

function Group({ title, count, children, className }: { title: string; count: number; children: React.ReactNode; className?: string }) {
  if (!count) return null;
  return (
    <Panel flush className={className} title={title} action={<span className="rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums">{count}</span>}>
      <ul className="divide-y divide-border">{children}</ul>
    </Panel>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const { q = "" } = await searchParams;
  const t = await getTranslations("soc.search");
  const ts = await getTranslations("reportStatus");
  const tc = await getTranslations("campaignStatus");
  const ctx = await requireRole("soc_analyst");
  const r = await globalSearch(ctx.supabase, q);
  if (!r) return <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Search} title={t("hint")} /></div>;
  const total = r.messages.length + r.domains.length + r.iocs.length + r.reports.length + r.campaigns.length;
  if (!total) return <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={SearchX} title={t("none", { q })} /></div>;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Group title={t("reports")} count={r.reports.length}>
        {r.reports.map((x) => (
          <li key={x.id}><Link href={`/soc/inbox/${x.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-accent/40"><span className="font-mono font-medium text-primary">{x.protocol}</span>{x.flag && <FlagBadge flag={x.flag} />}<Badge variant="outline">{ts(x.status)}</Badge></Link></li>
        ))}
      </Group>
      <Group title={t("campaigns")} count={r.campaigns.length}>
        {r.campaigns.map((x) => (
          <li key={x.id}><Link href={`/soc/campaigns/${x.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-accent/40"><span className="font-mono font-medium text-primary">{x.code}</span><span>{x.imitated_name}</span><Badge variant="outline">{tc(x.status)}</Badge></Link></li>
        ))}
      </Group>
      <Group title={t("domains")} count={r.domains.length}>
        {r.domains.map((x) => (
          <li key={x.id}><Link href={`/soc/domains?q=${encodeURIComponent(x.domain)}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-accent/40"><span className="font-mono">{x.domain.replace(/\./g, "[.]")}</span><Badge variant="outline">{x.class}</Badge></Link></li>
        ))}
      </Group>
      <Group title={t("iocs")} count={r.iocs.length}>
        {r.iocs.map((x) => (
          <li key={x.id} className="flex items-center gap-3 px-5 py-3 text-sm"><Badge variant="secondary">{x.type}</Badge><span className="truncate font-mono">{x.value.replace(/(?<!\[)\.(?!\])/g, "[.]")}</span>{x.campaigns && <Link className="ml-auto font-mono text-xs hover:underline" href={`/soc/campaigns/${(x.campaigns as { id: string }).id}`}>{(x.campaigns as { code: string }).code}</Link>}</li>
        ))}
      </Group>
      <Group title={t("messages")} count={r.messages.length} className="xl:col-span-2">
        {r.messages.map((x) => (
          <li key={x.id} className="space-y-1 px-5 py-3">
            <MaskedText text={x.body_masked} highlights={[q]} className="line-clamp-3 text-sm" />
            <p className="text-xs text-muted-foreground">{Math.round(x.similarity * 100)}% · {x.label}</p>
          </li>
        ))}
      </Group>
    </div>
  );
}

export default async function SearchPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, ts, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("soc.search"), getTranslations("socx")]);
  return (
    <DashPage title={t("search")} subtitle={tx("pages.search")}>
      <Suspense fallback={<Skeleton className="h-14 w-full rounded-xl" />}><UrlSearch label={ts("placeholder")} className="max-w-3xl [&_input]:h-14 [&_input]:rounded-xl [&_input]:pl-10 [&_input]:text-base" /></Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}><Results searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
