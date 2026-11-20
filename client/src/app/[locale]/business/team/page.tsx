import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { InviteMemberForm, MemberRow } from "@/components/business/forms";
import { DashPage } from "@/components/layout/dash";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";

const ROLES = ["owner", "admin", "security", "comms", "finance", "viewer", "contact"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("team") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin"]));
  const [tb, tr] = await Promise.all([getTranslations("biz"), getTranslations("orgRoles")]);
  const { data } = await ctx.supabase.from("organization_members").select("user_id, role, profiles(full_name)").eq("org_id", ctx.org.id).order("role");
  const members = data ?? [];
  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <InviteMemberForm />
        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-5"><CardTitle className="font-display text-lg">{tb("tm.members", { count: members.length })}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <MemberRow key={m.user_id} userId={m.user_id} name={(m.profiles as { full_name: string | null } | null)?.full_name ?? m.user_id.slice(0, 8)} role={m.role} isSelf={m.user_id === ctx.user.id} canEdit />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="xl:sticky xl:top-20 xl:col-span-4">
        <CardHeader><CardTitle className="font-display text-lg">{tb("tm.rolesTitle")}</CardTitle></CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            {ROLES.map((r) => (
              <div key={r} className="space-y-0.5">
                <dt className="font-medium">{tr(r)}</dt>
                <dd className="text-muted-foreground">{tb(`tm.roles.${r}`)}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("team")} subtitle={tb("pages.team")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
