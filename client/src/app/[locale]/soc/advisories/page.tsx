import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SeverityDot } from "@/components/shared/severity-dot";
import { AdvisoryForm, AdvisoryStatusButtons } from "@/components/soc/advisory-form";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { hasMinRole, requireRole } from "@/server/auth";
import { isMunicipalityCode, regionName } from "@/lib/geo/regions";

type Search = Promise<{ campaign?: string; region?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("advisories") };
}

async function Content({ searchParams }: { searchParams: Search }) {
  const { campaign, region } = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [t, locale] = await Promise.all([getTranslations("soc.advisories"), getLocale()]);
  const [camps, advs] = await Promise.all([
    ctx.supabase.from("campaigns").select("id, code, imitated_name, tactic").neq("status", "monitoring").order("last_seen", { ascending: false, nullsFirst: false }).limit(200),
    ctx.supabase.from("advisories").select("id, slug, title_sq, title_en, body_sq, body_en, status, severity, published_at, created_by, campaigns(code)").order("published_at", { ascending: false, nullsFirst: true }),
  ]);
  const isLead = hasMinRole(ctx.profile.platform_role, "soc_lead");
  return (
    <div className="space-y-6">
      <AdvisoryForm campaigns={camps.data ?? []} initialCampaign={campaign} initialRegion={region && isMunicipalityCode(region) ? { sq: regionName(region, "sq"), en: regionName(region, "en") } : undefined} />
      {!advs.data?.length ? <EmptyState title={t("empty")} /> : (
        <ul className="space-y-3">
          {advs.data.map((a) => (
            <li key={a.id} className="glass-card space-y-2 rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={a.status === "published" ? "default" : "outline"}>{t(`statuses.${a.status as "draft"}`)}</Badge>
                <SeverityDot severity={a.severity} />
                {a.campaigns && <span className="font-mono text-xs">{(a.campaigns as { code: string }).code}</span>}
                {a.published_at && <span className="text-xs text-muted-foreground">{fmtDate(a.published_at, locale)}</span>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div lang="sq"><p className="font-medium">{a.title_sq}</p><p className="line-clamp-3 text-sm text-muted-foreground">{a.body_sq}</p></div>
                <div lang="en"><p className="font-medium">{a.title_en}</p><p className="line-clamp-3 text-sm text-muted-foreground">{a.body_en}</p></div>
              </div>
              <AdvisoryStatusButtons id={a.id} status={a.status} isLead={isLead} isCreator={a.created_by === ctx.user.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdvisoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("advisories")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content searchParams={searchParams} /></Suspense>
    </div>
  );
}
