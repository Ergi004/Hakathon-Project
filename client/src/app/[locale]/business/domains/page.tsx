import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { DomainActions } from "@/components/business/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("domains") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin", "security"]));
  const [t, td, tc] = await Promise.all([getTranslations("biz.domains"), getTranslations("soc.domains"), getTranslations("domainClass")]);
  const { data } = await ctx.supabase.from("domains").select("id, domain, class, age_days, registrar, hosting_country, risk_score, status").order("risk_score", { ascending: false, nullsFirst: false }).limit(500);
  if (!data?.length) return <EmptyState title={t("empty")} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("allowlistHint")}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>{td("domain")}</TableHead><TableHead>{td("class")}</TableHead><TableHead className="hidden md:table-cell">{td("age")}</TableHead><TableHead className="hidden lg:table-cell">{td("registrar")}</TableHead><TableHead className="hidden lg:table-cell">{td("hosting")}</TableHead><TableHead>{td("risk")}</TableHead><TableHead>{td("status")}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.domain.replace(/\./g, "[.]")}</TableCell>
                <TableCell><Badge variant="outline">{tc(d.class)}</Badge></TableCell>
                <TableCell className="hidden text-xs md:table-cell">{d.age_days !== null ? td("ageDays", { count: d.age_days }) : "—"}</TableCell>
                <TableCell className="hidden text-xs lg:table-cell">{d.registrar ?? "—"}</TableCell>
                <TableCell className="hidden text-xs lg:table-cell">{d.hosting_country ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{d.risk_score ?? "—"}</TableCell>
                <TableCell><Badge variant={d.status === "threat" ? "destructive" : "secondary"}>{td(`statuses.${d.status as "threat"}`)}</Badge></TableCell>
                <TableCell><DomainActions id={d.id} status={d.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("domains")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
