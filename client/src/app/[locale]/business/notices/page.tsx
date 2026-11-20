import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Megaphone } from "lucide-react";
import { NoticeComposer } from "@/components/business/forms";
import { DashPage, EmptyPanel } from "@/components/layout/dash";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { orgInstitutionIds } from "@/server/queries/business";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("notices") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "comms"]));
  const [t, tb] = await Promise.all([getTranslations("biz.campaigns"), getTranslations("biz")]);
  const inst = await orgInstitutionIds(ctx);
  const { data } = inst.length ? await ctx.supabase.from("campaigns").select("id, code, tactic, campaign_domains(domains(domain))").in("institution_id", inst).order("last_seen", { ascending: false, nullsFirst: false }) : { data: [] };
  if (!data?.length) return <Card><CardContent><EmptyPanel icon={Megaphone} title={t("empty")} body={tb("cp.emptyBody")} /></CardContent></Card>;
  return <NoticeComposer brand={ctx.org.name} campaigns={data.map((c) => ({ id: c.id, code: c.code, tactic: c.tactic, domains: (c.campaign_domains ?? []).map((cd) => (cd.domains as { domain: string } | null)?.domain).filter((x): x is string => !!x) }))} />;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("notices")} subtitle={tb("pages.notices")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
