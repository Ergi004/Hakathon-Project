import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { FollowPanel, NotificationInbox } from "@/components/citizen/alerts";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("alerts") };
}

async function Content() {
  const ctx = await requireUser();
  const [notes, insts, follows] = await Promise.all([
    ctx.supabase.from("notifications").select("id, title, body, href, read_at, created_at").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("institutions").select("id, name").order("name"),
    ctx.supabase.from("user_follows").select("institution_id").eq("user_id", ctx.user.id),
  ]);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7 xl:col-span-8">
        <NotificationInbox items={notes.data ?? []} />
      </div>
      <aside className="lg:sticky lg:top-20 lg:col-span-5 xl:col-span-4">
        <FollowPanel institutions={insts.data ?? []} followed={(follows.data ?? []).map((f) => f.institution_id)} />
      </aside>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Skeleton className="h-96 rounded-xl lg:col-span-8" />
      <Skeleton className="h-96 rounded-xl lg:col-span-4" />
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.alerts");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<AlertsSkeleton />}><Content /></Suspense>
    </div>
  );
}
