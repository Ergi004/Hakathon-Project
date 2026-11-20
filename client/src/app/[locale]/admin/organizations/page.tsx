import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { OrgLinkSelect } from "@/components/soc/org-link-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "admin.nav" }))("organizations") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireRole("platform_admin"));
  const t = await getTranslations("admin.orgs");
  const [orgs, insts, assets] = await Promise.all([
    ctx.supabase.from("organizations").select("id, name, type, organization_members(user_id)").order("name"),
    ctx.supabase.from("institutions").select("id, name, organization_id").order("name"),
    ctx.supabase.from("brand_assets").select("org_id, value").eq("kind", "domain").not("verified_at", "is", null),
  ]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>{t("name")}</TableHead><TableHead>{t("type")}</TableHead><TableHead className="text-right">{t("members")}</TableHead><TableHead className="hidden md:table-cell">{t("assets")}</TableHead><TableHead>{t("institution")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(orgs.data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="text-xs">{o.type}</TableCell>
                <TableCell className="text-right font-mono">{o.organization_members?.length ?? 0}</TableCell>
                <TableCell className="hidden font-mono text-xs md:table-cell">{(assets.data ?? []).filter((a) => a.org_id === o.id).map((a) => a.value).join(", ") || "—"}</TableCell>
                <TableCell><OrgLinkSelect orgId={o.id} current={(insts.data ?? []).find((i) => i.organization_id === o.id)?.id ?? null} institutions={insts.data ?? []} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default async function OrganizationsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("admin.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("organizations")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
