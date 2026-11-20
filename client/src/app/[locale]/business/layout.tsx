import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrgSwitcher } from "@/components/business/org-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { ShellFallback } from "@/components/layout/shell-fallback";
import type { Locale } from "@/i18n/routing";
import { BUSINESS_NAV } from "@/lib/nav";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";

async function BusinessShell({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  // Active org comes from a cookie and is re-validated against organization_members.
  const ctx = await guardOrRedirect(() => requireActiveOrg());
  const t = await getTranslations("business");
  const tr = await getTranslations("orgRoles");
  const [{ data: memberships }, { count: openAlerts }] = await Promise.all([
    ctx.supabase.from("organization_members").select("organizations(id, name)").eq("user_id", ctx.user.id),
    ctx.supabase.from("brand_alerts").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id).eq("status", "new"),
  ]);
  const orgs = (memberships ?? []).map((m) => m.organizations as { id: string; name: string } | null).filter((o): o is { id: string; name: string } => !!o);
  const items = BUSINESS_NAV.map((i) => ({ href: i.href, icon: i.icon, label: t(`nav.${i.key}`), ...(i.key === "alerts" ? { count: openAlerts ?? 0 } : {}) }));

  return (
    <AppShell
      areaTitle={t("area")}
      items={items}
      user={{ name: ctx.profile.full_name ?? ctx.user.email ?? "", roleLabel: tr(ctx.orgRole) }}
      orgSlot={<OrgSwitcher current={{ id: ctx.org.id, name: ctx.org.name }} orgs={orgs} />}
      bellHref="/business/alerts"
    >
      {children}
    </AppShell>
  );
}

export default function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <BusinessShell params={params}>{children}</BusinessShell>
    </Suspense>
  );
}
