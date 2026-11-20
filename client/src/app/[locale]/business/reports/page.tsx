import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { FlagBadge } from "@/components/flags/flag-badge";
import { MaskedText } from "@/components/shared/masked-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { orgInstitutionIds } from "@/server/queries/business";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("reports") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security"]));
  const [t, ts, locale] = await Promise.all([getTranslations("biz.reports"), getTranslations("reportStatus"), getLocale()]);
  const inst = await orgInstitutionIds(ctx);
  // Anonymised: never select reporter_id, reporter_contact or tracking data.
  const { data } = inst.length
    ? await ctx.supabase.from("reports").select("id, protocol, status, flag, score, channel, created_at, campaigns!inner(code, institution_id), messages(body_masked)").in("campaigns.institution_id", inst).order("created_at", { ascending: false }).limit(300)
    : { data: [] };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{t("note")}</p>
        <Button asChild variant="outline" size="sm"><a href="/api/business/export/reports"><Download className="size-3.5" aria-hidden="true" />CSV</a></Button></div>
      {!data?.length ? <EmptyState title={t("empty")} /> : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className="glass-card space-y-2 rounded-xl p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono">{r.protocol}</span>{r.flag && <FlagBadge flag={r.flag} score={r.score} />}<Badge variant="outline">{ts(r.status)}</Badge><span className="font-mono">{(r.campaigns as { code: string }).code}</span><span className="ml-auto text-muted-foreground">{fmtDateTime(r.created_at, locale)}</span></div>
              {(r.messages as { body_masked: string } | null)?.body_masked && <MaskedText text={(r.messages as { body_masked: string }).body_masked} className="line-clamp-3 text-sm" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("reports")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
