import { Lock, PhoneCall } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { WIDE } from "@/components/home/section";
import { ReportWizard } from "@/components/report/report-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { getSessionUser } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "report" });
  return { title: t("title"), description: t("description") };
}

async function Wizard() {
  const session = await getSessionUser();
  return <ReportWizard signedIn={!!session} />;
}

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("report");
  const steps = t.raw("nextSteps") as { title: string; body: string }[];
  return (
    <div className={cn(WIDE, "space-y-8 pt-10 pb-20 md:pt-14")}>
      <header className="max-w-3xl space-y-3">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("description")}</p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Suspense fallback={<ReportWizard signedIn={false} />}>
            <Wizard />
          </Suspense>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:col-span-4">
          <Card className="border-flag-orange/40 bg-flag-orange/5">
            <CardContent className="flex gap-3">
              <PhoneCall className="mt-0.5 size-5 shrink-0 text-flag-orange" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium">{t("urgentTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("urgentBody")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">{t("nextTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l-2 border-dashed border-border pl-6">
                {steps.map((s, i) => (
                  <li key={s.title} className="relative">
                    <span className="absolute top-0 -left-[2.3rem] grid size-7 place-items-center rounded-full border-2 border-primary/40 bg-card text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.body}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <div className="flex gap-3 px-1 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p><span className="font-medium">{t("privacyTitle")}.</span> <span className="text-muted-foreground">{t("privacyBody")}</span></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
