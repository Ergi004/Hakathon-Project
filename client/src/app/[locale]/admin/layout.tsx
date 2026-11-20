import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ShellFallback } from "@/components/layout/shell-fallback";
import type { Locale } from "@/i18n/routing";
import { ADMIN_NAV } from "@/lib/nav";
import { guardOrRedirect, requireRole } from "@/server/auth";

async function AdminShell({ children }: { children: React.ReactNode }) {
  const ctx = await guardOrRedirect(() => requireRole("platform_admin"));
  const t = await getTranslations("admin");
  const tr = await getTranslations("roles");
  const items = ADMIN_NAV.map((i) => ({ href: i.href, icon: i.icon, label: t(`nav.${i.key}`) }));

  return (
    <AppShell
      areaTitle={t("area")}
      items={items}
      user={{ name: ctx.profile.full_name ?? ctx.user.email ?? "", roleLabel: tr(ctx.profile.platform_role) }}
    >
      {children}
    </AppShell>
  );
}

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return (
    <Suspense fallback={<ShellFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
