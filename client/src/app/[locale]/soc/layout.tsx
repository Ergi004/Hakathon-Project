import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ShellFallback } from "@/components/layout/shell-fallback";
import { SocStatusBar } from "@/components/layout/soc-status-bar";
import { CommandPalette } from "@/components/soc/command-palette";
import { RealtimeProvider } from "@/components/soc/realtime-provider";
import type { Locale } from "@/i18n/routing";
import { SOC_NAV } from "@/lib/nav";
import { guardOrRedirect, hasMinRole, requireRole } from "@/server/auth";

const LEAD_ONLY = new Set(["quality", "alerts", "admin"]);

async function SocShell({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const ctx = await guardOrRedirect(() => requireRole("soc_analyst"));
  const t = await getTranslations("soc");
  const tr = await getTranslations("roles");
  const isLead = hasMinRole(ctx.profile.platform_role, "soc_lead");
  const [{ count: open }, { data: lastReport }] = await Promise.all([
    ctx.supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "received"),
    ctx.supabase.from("reports").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const items = SOC_NAV.filter((i) => isLead || !LEAD_ONLY.has(i.key)).map((i) => ({
    href: i.href,
    icon: i.icon, group: i.group,
    label: t(`nav.${i.key}`),
    ...(i.key === "inbox" ? { count: open ?? 0, liveBadge: "inbox" as const } : {}),
  }));

  return (
    <RealtimeProvider>
      <AppShell
        areaTitle={t("area")}
        items={items}
        user={{ name: ctx.profile.full_name ?? ctx.user.email ?? "", roleLabel: tr(ctx.profile.platform_role) }}
        statusBar={<SocStatusBar lastSync={lastReport?.created_at ?? null} />}
        dense
      >
        {children}
      </AppShell>
      <CommandPalette />
    </RealtimeProvider>
  );
}

export default function SocLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  // params is read inside the Suspense boundary: on dynamic [id] routes it is runtime data.
  return (
    <Suspense fallback={<ShellFallback />}>
      <SocShell params={params}>{children}</SocShell>
    </Suspense>
  );
}
