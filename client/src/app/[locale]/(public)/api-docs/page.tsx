import { Download, Lock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TryScan } from "@/components/docs/try-scan";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { openapi } from "@/lib/openapi";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "apiDocs" });
  return { title: t("title"), description: t("description") };
}

const METHOD_STYLE: Record<string, string> = { get: "bg-flag-green/15 text-foreground", post: "bg-primary/15 text-foreground", delete: "bg-flag-red/15 text-foreground" };

export default async function ApiDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("apiDocs");
  const endpoints = Object.entries(openapi.paths).flatMap(([path, ops]) =>
    Object.entries(ops).map(([method, op]) => ({ path, method, op: op as { summary: string; security?: unknown[] } })),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<Button asChild variant="outline"><a href="/api/v1/openapi.json" download><Download className="size-4" aria-hidden="true" /> {t("openapi")}</a></Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {[["base", "/api/v1"], ["auth", t("authBody")], ["errors", t("errorsBody")], ["limits", t("limitsBody")]].map(([k, v]) => (
          <section key={k} className="glass-card space-y-1.5 rounded-xl p-5">
            <h2 className="font-display text-lg font-medium">{t(k as "base")}</h2>
            <p className={k === "base" ? "font-mono text-sm" : "text-sm text-muted-foreground"}>{v}</p>
          </section>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">{t("endpoints")}</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {endpoints.map((e) => (
            <li key={`${e.method} ${e.path}`} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
              <span className={`w-16 rounded px-2 py-0.5 text-center font-mono text-xs font-bold uppercase ${METHOD_STYLE[e.method] ?? ""}`}>{e.method}</span>
              <code className="font-mono text-sm">/api/v1{e.path}</code>
              <span className="flex-1 text-sm text-muted-foreground">{e.op.summary}</span>
              {e.op.security ? <Badge variant="outline" className="gap-1"><Lock className="size-3" aria-hidden="true" />Bearer</Badge> : <Badge variant="secondary">{t("authNone")}</Badge>}
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-display text-lg font-medium">cURL</h2>
          <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">{`curl -X POST "$APP_URL/api/v1/scan" \\
  -H "Authorization: Bearer mbk_…" \\
  -H "Content-Type: application/json" \\
  -d '{"kind":"url","urls":["hxxps://1ezhe-gov[.]al[.]example"],"channel":"sms","locale":"sq"}'`}</pre>
        </div>
        <TryScan />
      </section>
    </div>
  );
}
