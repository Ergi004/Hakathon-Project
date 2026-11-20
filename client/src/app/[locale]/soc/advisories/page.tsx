import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Eye, FilePen, Globe, Megaphone } from "lucide-react";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { SeverityDot } from "@/components/shared/severity-dot";
import { AdvisoryForm, AdvisoryStatusButtons } from "@/components/soc/advisory-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { hasMinRole, requireRole } from "@/server/auth";
import { isMunicipalityCode, regionName } from "@/lib/geo/regions";

type Search = Promise<{ campaign?: string; region?: string }>;
const TONE: Record<string, string> = { draft: "border-flag-yellow/40 bg-flag-yellow/10", in_review: "border-primary/40 bg-primary/10 text-primary", published: "border-flag-green/40 bg-flag-green/10" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("advisories") };
}

async function Content({ searchParams }: { searchParams: Search }) {
  const { campaign, region } = await searchParams;
  const ctx = await requireRole("soc_analyst");
  const [t, tx, locale] = await Promise.all([getTranslations("soc.advisories"), getTranslations("socx"), getLocale()]);
  const [camps, advs] = await Promise.all([
    ctx.supabase.from("campaigns").select("id, code, imitated_name, tactic").neq("status", "monitoring").order("last_seen", { ascending: false, nullsFirst: false }).limit(200),
    ctx.supabase.from("advisories").select("id, slug, title_sq, title_en, body_sq, body_en, status, severity, published_at, created_by, campaigns(code)").order("published_at", { ascending: false, nullsFirst: true }),
  ]);
  const isLead = hasMinRole(ctx.profile.platform_role, "soc_lead");
  const all = advs.data ?? [];
  const STAT = [["draft", FilePen, "text-flag-yellow"], ["in_review", Eye, "text-primary"], ["published", Globe, "text-flag-green"]] as const;
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-3 gap-3">
        {STAT.map(([s, Icon, tone]) => <li key={s}><StatCard icon={Icon} tone={tone} label={t(`statuses.${s}`)} value={all.filter((a) => a.status === s).length} /></li>)}
      </ul>
      <AdvisoryForm campaigns={camps.data ?? []} initialCampaign={campaign} initialRegion={region && isMunicipalityCode(region) ? { sq: regionName(region, "sq"), en: regionName(region, "en") } : undefined} />
      <section aria-labelledby="adv-list" className="space-y-3">
        <h2 id="adv-list" className="font-display text-lg font-medium">{tx("adv.list")}</h2>
        {!all.length ? <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={Megaphone} title={t("empty")} /></div> : (
          <ul className="grid gap-4 2xl:grid-cols-2">
            {all.map((a) => (
              <li key={a.id}>
                <Card className={cn("h-full gap-4 border-l-4 py-5", a.status === "published" ? "border-l-flag-green" : a.status === "in_review" ? "border-l-primary" : "border-l-flag-yellow")}>
                  <CardContent className="space-y-4 px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", TONE[a.status])}>{t(`statuses.${a.status as "draft"}`)}</span>
                      <SeverityDot severity={a.severity} />
                      {a.campaigns && <span className="font-mono text-xs text-muted-foreground">{(a.campaigns as { code: string }).code}</span>}
                      {a.published_at && <span className="ml-auto text-xs text-muted-foreground">{fmtDate(a.published_at, locale)}</span>}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(["sq", "en"] as const).map((l) => (
                        <div key={l} lang={l} className="space-y-1.5 rounded-xl bg-muted/40 p-4">
                          <span className="rounded-md bg-primary/12 px-1.5 py-0.5 font-mono text-[11px] text-primary">{l.toUpperCase()}</span>
                          <p className="pt-1 font-medium">{l === "sq" ? a.title_sq : a.title_en}</p>
                          <p className="line-clamp-3 text-sm text-muted-foreground">{l === "sq" ? a.body_sq : a.body_en}</p>
                        </div>
                      ))}
                    </div>
                    <AdvisoryStatusButtons id={a.id} status={a.status} isLead={isLead} isCreator={a.created_by === ctx.user.id} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function AdvisoriesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("advisories")} subtitle={tx("pages.advisories")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
