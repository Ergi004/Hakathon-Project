import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";
import { FollowList, NotificationsLive } from "@/components/citizen/forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("alerts") };
}

async function Content() {
  const ctx = await requireUser();
  const t = await getTranslations("cit.alerts");
  const [notes, insts, follows] = await Promise.all([
    ctx.supabase.from("notifications").select("id, title, body, href, read_at, created_at").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("institutions").select("id, name").order("name"),
    ctx.supabase.from("user_follows").select("institution_id").eq("user_id", ctx.user.id),
  ]);
  return (
    <div className="space-y-6">
      <section className="glass-card space-y-3 rounded-xl p-4">
        <h2 className="font-medium">{t("follow")}</h2>
        <p className="text-sm text-muted-foreground">{t("followHint")}</p>
        <FollowList institutions={insts.data ?? []} followed={(follows.data ?? []).map((f) => f.institution_id)} />
      </section>
      <NotificationsLive items={notes.data ?? []} />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("citizen.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("alerts")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
