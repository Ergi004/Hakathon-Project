import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { InviteMemberForm, MemberRow } from "@/components/business/forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("team") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin"]));
  const { data } = await ctx.supabase.from("organization_members").select("user_id, role, profiles(full_name)").eq("org_id", ctx.org.id).order("role");
  return (
    <div className="space-y-4">
      <InviteMemberForm />
      <ul className="space-y-2">
        {(data ?? []).map((m) => (
          <MemberRow key={m.user_id} userId={m.user_id} name={(m.profiles as { full_name: string | null } | null)?.full_name ?? m.user_id.slice(0, 8)} role={m.role} isSelf={m.user_id === ctx.user.id} canEdit />
        ))}
      </ul>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("team")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
