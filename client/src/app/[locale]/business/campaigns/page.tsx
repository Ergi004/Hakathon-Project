import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Flag, Gavel, Megaphone, MessageSquareWarning } from "lucide-react";
import { DashPage, EmptyPanel } from "@/components/layout/dash";
import { CampaignCard } from "@/components/shared/campaign-card";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { orgInstitutionIds } from "@/server/queries/business";
import { pageCount, pageParam, pageRange } from "@/lib/pagination";
import { Pager } from "@/components/shared/pager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("campaigns") };
}

const PAGE_SIZE = 8;
type SP = { page?: string };

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const page = pageParam((await searchParams).page);
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const [t, tb, tn, tk] = await Promise.all([getTranslations("biz.campaigns"), getTranslations("biz"), getTranslations("noticeStatus"), getTranslations("noticeType")]);
  const inst = await orgInstitutionIds(ctx);
  const { data, count: total } = inst.length
    ? await ctx.supabase.from("campaigns").select("id, code, tactic, imitated_name, first_seen, last_seen, message_count, status, campaign_domains(domains(domain)), takedown_notices(id, kind, status)", { count: "exact" }).in("institution_id", inst).order("last_seen", { ascending: false, nullsFirst: false }).order("id").range(...pageRange(page, PAGE_SIZE))
    : { data: [], count: 0 };
  if (!data?.length) return <Card><CardContent><EmptyPanel icon={Flag} title={t("empty")} body={tb("cp.emptyBody")} /></CardContent></Card>;
  return (
    <div className="space-y-6">
    <ul className="space-y-6">
      {data.map((c) => {
        const domains = (c.campaign_domains ?? []).map((cd) => (cd.domains as { domain: string } | null)?.domain).filter((x): x is string => !!x);
        const tell = t("tellText", { brand: ctx.org.name, domain: (domains[0] ?? "—").replace(/\./g, "[.]") });
        return (
          <li key={c.id} className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <CampaignCard c={{ ...c, domains }} href={`/threats/${encodeURIComponent(c.code)}`} />
            <div className="flex flex-col gap-3">
            {(c.takedown_notices ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs">
                <Gavel className="size-4 text-primary" aria-hidden="true" />
                <span className="font-medium">{t("takedowns")}</span>
                {c.takedown_notices.map((n) => (
                  <span key={n.id} className="rounded-full border border-border bg-muted/50 px-2 py-0.5">{tk(n.kind)} · {tn(n.status)}</span>
                ))}
              </div>
            )}
            <div className="flex-1 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="inline-flex items-center gap-2 font-medium"><MessageSquareWarning className="size-4 text-primary" aria-hidden="true" />{t("tell")}</p>
              <p className="text-muted-foreground">{tell}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton size="sm" value={tell} />
                <Button asChild size="sm" variant="ghost"><Link href="/business/notices"><Megaphone className="size-4" aria-hidden="true" />{t("draftNotice")}</Link></Button>
              </div>
            </div>
            </div>
          </li>
        );
      })}
    </ul>
    <Pager page={page} pages={pageCount(total, PAGE_SIZE)} />
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("campaigns")} subtitle={tb("pages.campaigns")}>
      <Suspense fallback={<div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
