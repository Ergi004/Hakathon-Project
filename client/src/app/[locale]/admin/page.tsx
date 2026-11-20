import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { KpiTile } from "@/components/charts/kpi-tile";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtAgo } from "@/lib/format";
import { guardOrRedirect, requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "admin" }))("area") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireRole("platform_admin"));
  const [t, tr, locale] = await Promise.all([getTranslations("admin"), getTranslations("roles"), getLocale()]);
  const db = ctx.supabase;
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [users, orgs, insts, reports, checks, campaigns, roles, audit] = await Promise.all([
    count(db.from("profiles").select("id", { count: "exact", head: true })),
    count(db.from("organizations").select("id", { count: "exact", head: true })),
    count(db.from("institutions").select("id", { count: "exact", head: true })),
    count(db.from("reports").select("id", { count: "exact", head: true })),
    count(db.from("checks").select("id", { count: "exact", head: true })),
    count(db.from("campaigns").select("id", { count: "exact", head: true })),
    db.from("profiles").select("platform_role"),
    db.from("audit_log").select("id, action, entity, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const byRole = new Map<string, number>();
  for (const r of roles.data ?? []) byRole.set(r.platform_role, (byRole.get(r.platform_role) ?? 0) + 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {([["users", users], ["orgs", orgs], ["institutions", insts], ["reports", reports], ["checks", checks], ["campaigns", campaigns]] as const).map(([k, v]) => <KpiTile key={k} label={t(`stats.${k}`)} value={v} />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="font-medium">{t("byRole")}</h2>
          <ul className="space-y-1.5 text-sm">{[...byRole.entries()].map(([r, n]) => <li key={r} className="flex justify-between"><span>{tr(r as "user")}</span><span className="font-mono">{n}</span></li>)}</ul>
          <Button asChild variant="outline" size="sm"><Link href="/soc/admin">{t("socAdmin")} <ArrowRight className="size-4" aria-hidden="true" /></Link></Button>
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4">
          <h2 className="font-medium">{t("recentAudit")}</h2>
          <ul className="space-y-1.5 text-sm">{(audit.data ?? []).map((a) => <li key={a.id} className="flex items-center gap-2"><Badge variant="outline" className="font-mono">{a.action}</Badge><span className="text-muted-foreground">{a.entity}</span><span className="ml-auto text-xs text-muted-foreground">{fmtAgo(a.created_at, locale)}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("admin");
  return (
    <div className="space-y-6">
      <PageHeader title={t("area")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
