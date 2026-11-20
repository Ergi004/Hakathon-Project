import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ChevronRight, KeyRound, Mail } from "lucide-react";
import { CitizenSettingsForm } from "@/components/citizen/forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("settings") };
}

async function Content() {
  const ctx = await requireUser();
  const t = await getTranslations("cit.settings");
  const p = ctx.profile;
  const methods = [...new Set((ctx.user.identities ?? []).map((i) => i.provider))];
  const account = (
    <div className="max-w-3xl space-y-3">
      <div className="divide-y divide-border rounded-xl border border-border">
        <div className="flex items-center gap-3 p-4">
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">{t("email")}</span>
          <span className="ml-auto truncate font-mono text-sm">{ctx.user.email}</span>
        </div>
        <div className="flex items-center gap-3 p-4">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">{t("methods")}</span>
          <span className="ml-auto flex flex-wrap justify-end gap-1.5">
            {(methods.length ? methods : ["email"]).map((m) => <Badge key={m} variant="secondary" className="capitalize">{m}</Badge>)}
          </span>
        </div>
      </div>
      <Link href="/citizen/privacy" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {t("privacyLink")}<ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
  return <CitizenSettingsForm name={p.full_name ?? ""} locale={p.locale as "sq" | "en"} notifyEmail={p.notify_email} notifyInApp={p.notify_in_app} account={account} />;
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.settings");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-8">
      <header className="space-y-1 border-b border-border pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </div>
  );
}
