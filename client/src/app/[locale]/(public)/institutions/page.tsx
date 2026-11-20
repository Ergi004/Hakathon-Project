import { Code2, ScanSearch, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { WIDE } from "@/components/home/section";
import { InstitutionDirectory } from "@/components/learn/institution-directory";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { getInstitutionDirectory } from "@/server/queries/public";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "institutions" });
  return { title: t("title"), description: t("description") };
}

async function Directory() {
  return <InstitutionDirectory entries={await getInstitutionDirectory()} />;
}

export default async function InstitutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const [t, ts] = await Promise.all([getTranslations("institutions"), getTranslations("home.specimen")]);
  return (
    <div className={cn(WIDE, "space-y-8 pt-10 pb-20 md:pt-14")}>
      <header className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <div className="space-y-3 lg:col-span-7">
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">{t("title")}</h1>
          <p className="max-w-[60ch] text-lg text-muted-foreground">{t("description")}</p>
        </div>
        <Card className="border-flag-orange/30 bg-flag-orange/5 ring-flag-orange/25 lg:col-span-5">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <TriangleAlert className="size-8 shrink-0 text-flag-orange" aria-hidden="true" />
            <div className="flex-1 space-y-1">
              <h2 className="font-display font-bold">{t("tipTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("tipBody")}</p>
            </div>
            <Button asChild className="shrink-0 rounded-full">
              <Link href="/check"><ScanSearch className="size-4" aria-hidden="true" />{ts("headerCta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </header>

      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
          </div>
        }
      >
        <Directory />
      </Suspense>

      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Code2 className="size-4" aria-hidden="true" />
        <span className="font-mono">{t("verifyHint")}</span>
      </p>
    </div>
  );
}
