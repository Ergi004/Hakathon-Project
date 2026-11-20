import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ThresholdSimulator } from "@/components/soc/threshold-simulator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/flags";
import { fmtAgo } from "@/lib/format";
import { guardOrRedirect, hasMinRole, requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("quality") };
}

async function Content() {
  const ctx = await guardOrRedirect(() => requireRole("soc_lead"));
  const [t, tu, locale] = await Promise.all([getTranslations("soc.quality"), getTranslations("ui"), getLocale()]);
  const [labels, model, settings] = await Promise.all([
    ctx.supabase.from("feedback_labels").select("id, predicted, actual, created_at, report_id, reports(protocol)").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("model_versions").select("name, version, metrics, created_at").eq("active", true).maybeSingle(),
    ctx.supabase.from("settings").select("value").eq("key", "thresholds").maybeSingle(),
  ]);
  const queue = (labels.data ?? []).filter((l) => l.predicted && l.predicted !== l.actual);
  const m = model.data?.metrics as { precision?: number; recall?: number; f1?: number; confusion?: { tp: number; fp: number; tn: number; fn: number } } | undefined;
  const c = m?.confusion;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...((settings.data?.value as Partial<Thresholds>) ?? {}) };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="glass-card space-y-3 rounded-xl p-4">
        <h2 className="font-medium">{t("model")}</h2>
        {model.data ? (
          <>
            <p className="font-mono text-sm">{model.data.name}@{model.data.version} · {fmtAgo(model.data.created_at, locale)}</p>
            <dl className="grid grid-cols-3 gap-3">
              {[["precision", m?.precision], ["recall", m?.recall], ["f1", m?.f1]].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg border border-border p-3"><dt className="text-xs text-muted-foreground">{t(k as "f1")}</dt><dd className="font-display text-2xl font-bold">{v ?? "—"}</dd></div>
              ))}
            </dl>
            {c && (
              <table className="w-full max-w-sm text-center text-sm" aria-label={t("matrix")}>
                <caption className="pb-2 text-left text-xs text-muted-foreground">{t("matrix")}</caption>
                <thead><tr><th /><th scope="col" className="font-normal text-muted-foreground">{t("predicted")}: +</th><th scope="col" className="font-normal text-muted-foreground">{t("predicted")}: −</th></tr></thead>
                <tbody>
                  <tr><th scope="row" className="font-normal text-muted-foreground">{t("actual")}: +</th><td className="rounded bg-flag-green/15 p-2 font-mono">{c.tp}</td><td className="rounded bg-flag-red/15 p-2 font-mono">{c.fn}</td></tr>
                  <tr><th scope="row" className="font-normal text-muted-foreground">{t("actual")}: −</th><td className="rounded bg-flag-orange/15 p-2 font-mono">{c.fp}</td><td className="rounded bg-flag-green/15 p-2 font-mono">{c.tn}</td></tr>
                </tbody>
              </table>
            )}
          </>
        ) : <p className="text-sm text-muted-foreground">{t("noModel")}</p>}
      </section>

      <section className="glass-card space-y-3 rounded-xl p-4">
        <h2 className="font-medium">{t("simulator")}</h2>
        <ThresholdSimulator initial={thresholds} canSave={hasMinRole(ctx.profile.platform_role, "platform_admin")} />
      </section>

      <section className="glass-card space-y-3 rounded-xl p-4 xl:col-span-2">
        <h2 className="font-medium">{t("queue")}</h2>
        {!queue.length ? <EmptyState title={tu("empty")} /> : (
          <ul className="space-y-2">
            {queue.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2.5 text-sm">
                <Badge variant={l.predicted === "phishing" ? "outline" : "destructive"}>{l.predicted === "phishing" ? t("fp") : t("fn")}</Badge>
                {l.report_id && <Link href={`/soc/inbox/${l.report_id}`} className="font-mono text-xs hover:underline">{(l.reports as { protocol: string } | null)?.protocol}</Link>}
                <span className="text-xs text-muted-foreground">{t("predicted")}: {l.predicted} → {t("actual")}: {l.actual}</span>
                <span className="ml-auto text-xs text-muted-foreground">{fmtAgo(l.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function QualityPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("quality")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
