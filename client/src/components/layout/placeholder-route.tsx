import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type messages from "../../../messages/sq.json";
import { guardOrRedirect, requireActiveOrg, requireRole, type OrgRole, type StaffRole } from "@/server/auth";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

type M = typeof messages;
type NavKeys = {
  "public.nav": keyof M["public"]["nav"];
  "citizen.nav": keyof M["citizen"]["nav"];
  "business.nav": keyof M["business"]["nav"];
  "soc.nav": keyof M["soc"]["nav"];
  "admin.nav": keyof M["admin"]["nav"];
};

type Params = { params: Promise<{ locale: string }> };

/**
 * Phase 0 placeholder for a route from SPEC 7-10: title, metadata and the
 * page-level role guard from the spec tables. Feature phases replace these.
 */
export function placeholderRoute<N extends keyof NavKeys>(
  ns: N,
  key: NavKeys[N],
  guard?: { minRole?: StaffRole; orgRoles?: readonly OrgRole[] },
) {
  async function title(locale: string) {
    const t = await getTranslations({ locale: locale as Locale, namespace: ns });
    return (t as unknown as (k: string) => string)(key as string);
  }

  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { locale } = await params;
    return { title: await title(locale) };
  }

  async function Page({ params }: Params) {
    const { locale } = await params;
    setRequestLocale(locale as Locale);
    if (guard?.minRole) await guardOrRedirect(() => requireRole(guard.minRole!));
    if (guard?.orgRoles) await guardOrRedirect(() => requireActiveOrg(guard.orgRoles));
    const tc = await getTranslations("common");
    const isPublic = ns === "public.nav";

    return (
      <div className={isPublic ? "mx-auto max-w-6xl space-y-6 px-4 py-12 md:px-8" : "space-y-6"}>
        <PageHeader title={await title(locale)} />
        <EmptyState
          icon={<Construction className="size-5" />}
          title={tc("placeholderTitle")}
          description={tc("placeholderBody")}
        />
      </div>
    );
  }

  return { Page, generateMetadata };
}
