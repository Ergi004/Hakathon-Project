import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { SimReportButton } from "@/components/home/sim-report-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { recordSimEvent } from "@/server/simulation";

type P = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ t?: string }> };

export const metadata: Metadata = { robots: { index: false } };

async function Landing({ params, searchParams }: P) {
  const [{ locale, id }, { t: token = "" }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale as Locale);
  const t = await getTranslations("sim");
  if (z.uuid().safeParse(id).success) await recordSimEvent(id, token, "clicked");
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-16 text-center md:px-8">
      <GraduationCap className="mx-auto size-12 text-primary" aria-hidden="true" />
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <div className="glass-card space-y-2 rounded-xl p-5 text-left">
        <h2 className="font-medium">{t("signs")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">{(t.raw("signsItems") as string[]).map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <SimReportButton simId={id} token={token} />
        <Button asChild variant="outline"><Link href="/learn">{t("learn")}</Link></Button>
      </div>
    </div>
  );
}

export default function SimLandingPage(props: P) {
  return <Suspense fallback={null}><Landing {...props} /></Suspense>;
}
