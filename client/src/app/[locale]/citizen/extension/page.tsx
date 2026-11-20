import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { ExtensionControls } from "@/components/citizen/forms";
import { EmptyState } from "@/components/layout/empty-state";
import { FlagBadge } from "@/components/flags/flag-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fmtAgo, fmtDateTime } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("extension") };
}

async function Content() {
  const ctx = await requireUser();
  const [t, locale] = await Promise.all([getTranslations("cit.extension"), getLocale()]);
  const { data: installs } = await ctx.supabase.from("extension_installs").select("id, version, auto_submit, consent_at, last_seen").eq("user_id", ctx.user.id);
  const { data: sent } = (installs ?? []).length ? await ctx.supabase.from("extension_reports").select("id, created_at, signals").in("install_id", (installs ?? []).map((i) => i.id)).order("created_at", { ascending: false }).limit(50) : { data: [] };
  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">{t("intro")}</p>
      <section className="space-y-3">
        <h2 className="font-medium">{t("installs")}</h2>
        {!installs?.length ? <EmptyState title={t("none")} action={<Button asChild variant="outline"><Link href="/extension">{t("howTo")}</Link></Button>} /> : installs.map((i) => (
          <div key={i.id} className="glass-card space-y-3 rounded-xl p-4 text-sm">
            <p className="text-muted-foreground">{t("version")}: <span className="font-mono text-foreground">{i.version ?? "—"}</span> · {t("lastSeen")}: {fmtAgo(i.last_seen, locale)}{i.consent_at ? ` · ${t("consentAt", { date: fmtDateTime(i.consent_at, locale) })}` : ""}</p>
            <ExtensionControls id={i.id} autoSubmit={i.auto_submit} />
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">{t("sent")}</h2>
        {!sent?.length ? <p className="text-sm text-muted-foreground">{t("noneSent")}</p> : (
          <ul className="space-y-2">
            {sent.map((s) => { const sig = s.signals as { flag?: "red"; score?: number; senderDomain?: string; subject?: string; urls?: string[] }; return (
              <li key={s.id} className="glass-card space-y-1 rounded-xl p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">{sig.flag && <FlagBadge flag={sig.flag} score={sig.score} />}<span className="font-mono text-xs">{sig.senderDomain?.replace(/\./g, "[.]") ?? "—"}</span><span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(s.created_at, locale)}</span></div>
                {sig.subject && <p className="text-muted-foreground">{sig.subject}</p>}
                {(sig.urls ?? []).slice(0, 3).map((u) => <p key={u} className="font-mono text-xs text-muted-foreground">{u.replace(/\./g, "[.]").replace(/^http/i, "hxxp")}</p>)}
              </li>
            ); })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("extension")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
