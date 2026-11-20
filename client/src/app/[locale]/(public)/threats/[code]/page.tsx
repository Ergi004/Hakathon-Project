import { ArrowLeft, Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { EmptyState } from "@/components/layout/empty-state";
import { DefangedText } from "@/components/shared/defanged-text";
import { MaskedText } from "@/components/shared/masked-text";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtDate } from "@/lib/format";
import { getPublicCampaign } from "@/server/queries/public";

type Params = Promise<{ locale: string; code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const c = await getPublicCampaign(decodeURIComponent(code));
  return { title: c ? `${c.code} · ${c.imitated_name ?? ""}` : decodeURIComponent(code) };
}

async function CampaignView({ params }: { params: Params }) {
  const { locale, code } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("campaign");
  const ts = await getTranslations("campaignStatus");
  const c = await getPublicCampaign(decodeURIComponent(code));
  if (!c) return <EmptyState title={t("notFound")} action={<Button asChild variant="outline"><Link href="/threats">{t("back")}</Link></Button>} />;
  const inst = c.imitated_name ?? "—";
  const l = locale as Locale;
  const statusOrder = ["monitoring", "confirmed", "takedown_in_progress", "resolved"] as const;
  const idx = statusOrder.indexOf(c.status ?? "confirmed");

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-sm text-muted-foreground">{c.code}</p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{inst}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{c.tactic.replace(/_/g, " ")}</Badge>
          {c.status && <Badge>{ts(c.status)}</Badge>}
        </div>
        <StatusTimeline orientation="horizontal" steps={statusOrder.map((s, i) => ({ key: s, label: ts(s), state: i < idx ? "done" : i === idx ? "current" : "pending" }))} />
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("firstSeen"), fmtDate(c.first_seen, locale)],
          [t("lastSeen"), fmtDate(c.last_seen, locale)],
          [t("messages"), String(c.message_count ?? 0)],
          [t("domains"), String(c.domains?.length ?? 0)],
        ].map(([k, v]) => (
          <div key={k} className="glass-card rounded-xl p-4">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-display text-xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      {c.weekly.length > 1 && (
        <section className="glass-card space-y-3 rounded-xl p-4 md:p-6">
          <h2 className="font-display text-lg font-medium">{t("timeline")}</h2>
          <WeeklyBars
            data={c.weekly.map((w) => ({ week: fmtDate(w.week, locale, "d MMM"), count: w.count }))}
            label={t("messages")}
            summary={`${t("timelineSr")} ${c.weekly.map((w) => `${fmtDate(w.week, locale)}: ${w.count}`).join("; ")}`}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass-card space-y-3 rounded-xl p-4 md:p-6">
          <h2 className="font-display text-lg font-medium">{t("example")}</h2>
          {c.sample ? <MaskedText text={c.sample} className="rounded-lg bg-muted/50 p-4" /> : <p className="text-sm text-muted-foreground">{t("noExample")}</p>}
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4 md:p-6">
          <h2 className="font-display text-lg font-medium">{t("domains")}</h2>
          <ul className="space-y-1">
            {(c.domains ?? []).map((d) => (
              <li key={d}><DefangedText value={d} revealable={false} /></li>
            ))}
          </ul>
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4 md:p-6">
          <h2 className="font-display text-lg font-medium">{t("recognise")}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {(t.raw("recogniseItems") as string[]).map((s) => <li key={s}>{s.replace("{institution}", inst)}</li>)}
          </ul>
        </section>
        <section className="glass-card space-y-3 rounded-xl p-4 md:p-6">
          <h2 className="font-display text-lg font-medium">{t("whatToDo")}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {(t.raw("todoItems") as string[]).map((s) => <li key={s}>{s.replace("{institution}", inst)}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm"><Link href="/check">{t("checkCta")}</Link></Button>
            <Button asChild size="sm" variant="outline"><Link href="/report">{t("reportCta")}</Link></Button>
          </div>
        </section>
      </div>

      {c.advisories.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-medium">{t("advisories")}</h2>
          {c.advisories.map((a) => (
            <div key={a.slug} className="glass-card space-y-2 rounded-xl p-4">
              <p className="inline-flex items-center gap-2 font-medium"><Megaphone className="size-4 text-primary" aria-hidden="true" />{l === "en" ? a.title_en : a.title_sq}</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{l === "en" ? a.body_en : a.body_sq}</p>
              <p className="text-xs text-muted-foreground">{fmtDate(a.published_at, locale)}</p>
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

export default function PublicCampaignPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12 md:px-8">
      <Suspense fallback={null}>
        <BackLink params={params} />
      </Suspense>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>}>
        <CampaignView params={params} />
      </Suspense>
    </div>
  );
}

async function BackLink({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "campaign" });
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href="/threats"><ArrowLeft className="size-4" aria-hidden="true" /> {t("back")}</Link>
    </Button>
  );
}
