import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CheckCheck, Cpu, ShieldX, Target, TriangleAlert } from "lucide-react";
import { DashPage, EmptyPanel, Panel, StatCard } from "@/components/layout/dash";
import { ThresholdSimulator } from "@/components/soc/threshold-simulator";
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
  const [t, tu, tx, locale] = await Promise.all([getTranslations("soc.quality"), getTranslations("ui"), getTranslations("socx"), getLocale()]);
  const [labels, model, settings] = await Promise.all([
    ctx.supabase.from("feedback_labels").select("id, predicted, actual, created_at, report_id, reports(protocol)").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("model_versions").select("name, version, metrics, created_at").eq("active", true).maybeSingle(),
    ctx.supabase.from("settings").select("value").eq("key", "thresholds").maybeSingle(),
  ]);
  const queue = (labels.data ?? []).filter((l) => l.predicted && l.predicted !== l.actual);
  const m = model.data?.metrics as { precision?: number; recall?: number; f1?: number; confusion?: { tp: number; fp: number; tn: number; fn: number } } | undefined;
  const c = m?.confusion;
  const thresholds = { ...DEFAULT_THRESHOLDS, ...((settings.data?.value as Partial<Thresholds>) ?? {}) };

  const fp = queue.filter((l) => l.predicted === "phishing").length;
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {(["precision", "recall", "f1"] as const).map((k) => <li key={k}><StatCard icon={Target} label={t(k)} value={m?.[k] ?? "—"} /></li>)}
        <li><StatCard icon={TriangleAlert} tone="text-flag-orange" label={tx("q.fp")} value={fp} /></li>
        <li><StatCard icon={ShieldX} tone="text-flag-red" label={tx("q.fn")} value={queue.length - fp} /></li>
      </ul>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title={t("model")} description={model.data ? <span className="font-mono">{model.data.name}@{model.data.version} · {fmtAgo(model.data.created_at, locale)}</span> : undefined}>
          {model.data ? (
            c ? (
              <table className="w-full max-w-md text-center text-sm" aria-label={t("matrix")}>
                <caption className="pb-3 text-left text-sm font-medium">{t("matrix")}</caption>
                <thead><tr><th /><th scope="col" className="pb-2 font-normal text-muted-foreground">{t("predicted")}: +</th><th scope="col" className="pb-2 font-normal text-muted-foreground">{t("predicted")}: −</th></tr></thead>
                <tbody className="[&_td]:border-4 [&_td]:border-card">
                  <tr><th scope="row" className="pr-3 text-right font-normal text-muted-foreground">{t("actual")}: +</th><td className="rounded-xl bg-flag-green/15 p-5 font-display text-2xl font-bold">{c.tp}</td><td className="rounded-xl bg-flag-red/15 p-5 font-display text-2xl font-bold">{c.fn}</td></tr>
                  <tr><th scope="row" className="pr-3 text-right font-normal text-muted-foreground">{t("actual")}: −</th><td className="rounded-xl bg-flag-orange/15 p-5 font-display text-2xl font-bold">{c.fp}</td><td className="rounded-xl bg-flag-green/15 p-5 font-display text-2xl font-bold">{c.tn}</td></tr>
                </tbody>
              </table>
            ) : null
          ) : <EmptyPanel icon={Cpu} title={t("noModel")} />}
        </Panel>

        <Panel title={t("simulator")}>
          <ThresholdSimulator initial={thresholds} canSave={hasMinRole(ctx.profile.platform_role, "platform_admin")} />
        </Panel>
      </div>

      <Panel flush title={t("queue")} description={tx("q.labels")}>
        {!queue.length ? <EmptyPanel icon={CheckCheck} tone="text-flag-green" title={tu("empty")} /> : (
          <ul className="divide-y divide-border">
            {queue.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className={l.predicted === "phishing" ? "rounded-full border border-flag-orange/40 bg-flag-orange/10 px-2.5 py-0.5 text-xs font-medium" : "rounded-full border border-flag-red/40 bg-flag-red/10 px-2.5 py-0.5 text-xs font-medium"}>{l.predicted === "phishing" ? t("fp") : t("fn")}</span>
                {l.report_id && <Link href={`/soc/inbox/${l.report_id}`} className="font-mono text-xs font-medium text-primary hover:underline">{(l.reports as { protocol: string } | null)?.protocol}</Link>}
                <span className="text-xs text-muted-foreground">{t("predicted")}: {l.predicted} → {t("actual")}: {l.actual}</span>
                <span className="ml-auto text-xs text-muted-foreground">{fmtAgo(l.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export default async function QualityPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("quality")} subtitle={tx("pages.quality")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content /></Suspense>
    </DashPage>
  );
}
