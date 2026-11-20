import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { NoticeComposer } from "@/components/business/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { orgInstitutionIds } from "@/server/queries/business";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("notices") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "comms"]));
  const t = await getTranslations("biz.campaigns");
  const inst = await orgInstitutionIds(ctx);
  const { data } = inst.length ? await ctx.supabase.from("campaigns").select("id, code, tactic, campaign_domains(domains(domain))").in("institution_id", inst).order("last_seen", { ascending: false, nullsFirst: false }) : { data: [] };
  if (!data?.length) return <EmptyState title={t("empty")} />;
  return <NoticeComposer brand={ctx.org.name} campaigns={data.map((c) => ({ id: c.id, code: c.code, tactic: c.tactic, domains: (c.campaign_domains ?? []).map((cd) => (cd.domains as { domain: string } | null)?.domain).filter((x): x is string => !!x) }))} />;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("notices")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
