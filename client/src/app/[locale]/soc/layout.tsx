import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ShellFallback } from "@/components/layout/shell-fallback";
import { SocStatusBar } from "@/components/layout/soc-status-bar";
import type { Locale } from "@/i18n/routing";
import { SOC_NAV } from "@/lib/nav";
import { guardOrRedirect, requireRole } from "@/server/auth";

async function SocShell({ children }: { children: React.ReactNode }) {
  const ctx = await guardOrRedirect(() => requireRole("soc_analyst"));
  const t = await getTranslations("soc");
  const tr = await getTranslations("roles");
  const items = SOC_NAV.map((i) => ({ href: i.href, icon: i.icon, label: t(`nav.${i.key}`) }));

  return (
    <AppShell
      areaTitle={t("area")}
      items={items}
      user={{ name: ctx.profile.full_name ?? ctx.user.email ?? "", roleLabel: tr(ctx.profile.platform_role) }}
      statusBar={<SocStatusBar />}
      dense
    >
      {children}
    </AppShell>
  );
}

export default async function SocLayout({
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
      <SocShell>{children}</SocShell>
    </Suspense>
  );
}
