import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section className="space-y-2">
      <h2 className="font-display text-base font-medium">{title} <span className="text-muted-foreground">({count})</span></h2>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

async function Results({ searchParams }: { searchParams: Search }) {
  const { q = "" } = await searchParams;
  const t = await getTranslations("soc.search");
  const ts = await getTranslations("reportStatus");
  const tc = await getTranslations("campaignStatus");
  const ctx = await requireRole("soc_analyst");
  const r = await globalSearch(ctx.supabase, q);
  if (!r) return <p className="text-sm text-muted-foreground">{t("hint")}</p>;
  const total = r.messages.length + r.domains.length + r.iocs.length + r.reports.length + r.campaigns.length;
  if (!total) return <EmptyState title={t("none", { q })} />;
  return (
    <div className="space-y-6">
      <Group title={t("reports")} count={r.reports.length}>
        {r.reports.map((x) => (
          <li key={x.id}><Link href={`/soc/inbox/${x.id}`} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm hover:bg-accent"><span className="font-mono">{x.protocol}</span>{x.flag && <FlagBadge flag={x.flag} />}<Badge variant="outline">{ts(x.status)}</Badge></Link></li>
        ))}
      </Group>
      <Group title={t("campaigns")} count={r.campaigns.length}>
        {r.campaigns.map((x) => (
          <li key={x.id}><Link href={`/soc/campaigns/${x.id}`} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm hover:bg-accent"><span className="font-mono">{x.code}</span><span>{x.imitated_name}</span><Badge variant="outline">{tc(x.status)}</Badge></Link></li>
        ))}
      </Group>
      <Group title={t("domains")} count={r.domains.length}>
        {r.domains.map((x) => (
          <li key={x.id}><Link href={`/soc/domains?q=${encodeURIComponent(x.domain)}`} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm hover:bg-accent"><span className="font-mono">{x.domain.replace(/\./g, "[.]")}</span><Badge variant="outline">{x.class}</Badge></Link></li>
        ))}
      </Group>
      <Group title={t("iocs")} count={r.iocs.length}>
        {r.iocs.map((x) => (
          <li key={x.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm"><Badge variant="secondary">{x.type}</Badge><span className="truncate font-mono">{x.value.replace(/(?<!\[)\.(?!\])/g, "[.]")}</span>{x.campaigns && <Link className="ml-auto font-mono text-xs hover:underline" href={`/soc/campaigns/${(x.campaigns as { id: string }).id}`}>{(x.campaigns as { code: string }).code}</Link>}</li>
        ))}
      </Group>
      <Group title={t("messages")} count={r.messages.length}>
        {r.messages.map((x) => (
          <li key={x.id} className="space-y-1 rounded-lg border border-border p-2.5">
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
  const [t, ts] = await Promise.all([getTranslations("soc.nav"), getTranslations("soc.search")]);
  return (
    <div className="space-y-5">
      <PageHeader title={t("search")} description={ts("hint")} />
      <Suspense fallback={<Skeleton className="h-10 w-full max-w-xl" />}><UrlSearch label={ts("placeholder")} className="max-w-xl" /></Suspense>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}><Results searchParams={searchParams} /></Suspense>
    </div>
  );
}
