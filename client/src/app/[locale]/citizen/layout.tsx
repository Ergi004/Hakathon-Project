import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ShellFallback } from "@/components/layout/shell-fallback";
import type { Locale } from "@/i18n/routing";
import { CITIZEN_NAV } from "@/lib/nav";
import { requireUser } from "@/server/auth";

async function CitizenShell({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const ctx = await requireUser();
  const t = await getTranslations("citizen");
  const tr = await getTranslations("roles");
  const items = CITIZEN_NAV.map((i) => ({ href: i.href, icon: i.icon, mobile: "mobile" in i, label: t(`nav.${i.key}`) }));

  return (
    <AppShell
      areaTitle={t("area")}
      items={items}
      user={{ name: ctx.profile.full_name ?? ctx.user.email ?? "", roleLabel: tr(ctx.profile.platform_role) }}
      bellHref="/citizen/alerts"
      bottomNav
    >
      {children}
    </AppShell>
  );
}

export default function CitizenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <CitizenShell params={params}>{children}</CitizenShell>
    </Suspense>
  );
}
