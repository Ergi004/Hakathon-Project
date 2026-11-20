import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { MessageSquareWarning } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { CampaignCard } from "@/components/shared/campaign-card";
import { CopyButton } from "@/components/shared/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { orgInstitutionIds } from "@/server/queries/business";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("campaigns") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const [t, tn, tk] = await Promise.all([getTranslations("biz.campaigns"), getTranslations("noticeStatus"), getTranslations("noticeType")]);
  const inst = await orgInstitutionIds(ctx);
  if (!inst.length) return <EmptyState title={t("empty")} />;
  const { data } = await ctx.supabase.from("campaigns").select("id, code, tactic, imitated_name, first_seen, last_seen, message_count, status, campaign_domains(domains(domain)), takedown_notices(id, kind, status)").in("institution_id", inst).order("last_seen", { ascending: false, nullsFirst: false });
  if (!data?.length) return <EmptyState title={t("empty")} />;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {data.map((c) => {
        const domains = (c.campaign_domains ?? []).map((cd) => (cd.domains as { domain: string } | null)?.domain).filter((x): x is string => !!x);
        const tell = t("tellText", { brand: ctx.org.name, domain: (domains[0] ?? "—").replace(/\./g, "[.]") });
        return (
          <section key={c.id} className="space-y-3">
            <CampaignCard c={{ ...c, domains }} />
            {(c.takedown_notices ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">{t("takedowns")}:</span>{c.takedown_notices.map((n) => <Badge key={n.id} variant="outline">{tk(n.kind)} · {tn(n.status)}</Badge>)}</div>
            )}
            <div className="rounded-xl border border-border p-3 text-sm">
              <p className="mb-1 inline-flex items-center gap-2 font-medium"><MessageSquareWarning className="size-4 text-primary" aria-hidden="true" />{t("tell")}</p>
              <p className="text-muted-foreground">{tell}</p>
              <div className="mt-2 flex gap-2"><CopyButton size="sm" value={tell} /><Button asChild size="sm" variant="ghost"><Link href="/business/notices">{t("draftNotice")}</Link></Button></div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("campaigns")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
