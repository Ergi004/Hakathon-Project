import { CalendarClock, CalendarPlus, Check, CircleAlert, Globe, Megaphone, MessageSquare, ScanSearch, Target, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { WIDE } from "@/components/home/section";
import { EmptyState } from "@/components/layout/empty-state";
import { CampaignStatusBadge, STATUS_STYLE } from "@/components/shared/campaign-status";
import { DefangedText } from "@/components/shared/defanged-text";
import { MaskedText } from "@/components/shared/masked-text";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getPublicCampaign } from "@/server/queries/public";

type Params = Promise<{ locale: string; code: string }>;

const STATUS_ORDER = ["monitoring", "confirmed", "takedown_in_progress", "resolved"] as const;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const c = await getPublicCampaign(decodeURIComponent(code));
  return { title: c ? `${c.code} · ${c.imitated_name ?? ""}` : decodeURIComponent(code) };
}

async function CampaignView({ params }: { params: Params }) {
  const { locale, code } = await params;
  setRequestLocale(locale as Locale);
  const [t, ts, tn, c] = await Promise.all([
    getTranslations("campaign"),
    getTranslations("campaignStatus"),
    getTranslations("threats"),
    getPublicCampaign(decodeURIComponent(code)),
  ]);
  if (!c) return <EmptyState title={t("notFound")} action={<Button asChild variant="outline"><Link href="/threats">{t("back")}</Link></Button>} />;

  const inst = c.imitated_name ?? "—";
  const l = locale as Locale;
  const status = c.status ?? "confirmed";
  const idx = STATUS_ORDER.indexOf(status);
  const active = status !== "resolved";
  const domains = c.domains ?? [];

  const facts = [
    { icon: CalendarPlus, label: t("firstSeen"), value: fmtDate(c.first_seen, locale) },
    { icon: CalendarClock, label: t("lastSeen"), value: fmtDate(c.last_seen, locale) },
    { icon: MessageSquare, label: t("messages"), value: String(c.message_count ?? 0) },
    { icon: Globe, label: t("domains"), value: String(domains.length) },
  ];

  return (
    <article className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link href="/threats">{tn("title")}</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">{c.code}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Overview: who it imitates, where it stands, and the key numbers */}
      <Card className="relative gap-0 py-0">
        {active && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-flag-red/70" />}
        <CardContent className="space-y-8 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{c.code}</span>
                <CampaignStatusBadge status={status} />
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">{inst}</h1>
              <p className="flex items-center gap-2 text-lg text-muted-foreground capitalize">
                <Target className="size-5 shrink-0" aria-hidden="true" />
                {c.tactic.replace(/_/g, " ")}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/check"><ScanSearch className="size-4" aria-hidden="true" />{t("checkCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link href="/report">{t("reportCta")}</Link>
              </Button>
            </div>
          </div>

          {/* Progress stepper: each step explains what it means */}
          <section aria-labelledby="progress-title" className="space-y-4">
            <h2 id="progress-title" className="text-sm font-medium text-muted-foreground">{t("progress")}</h2>
            <ol className="grid gap-4 sm:grid-cols-4 sm:gap-0">
              {STATUS_ORDER.map((s, i) => {
                // A resolved campaign has finished every step.
                const state = i < idx || (i === idx && !active) ? "done" : i === idx ? "current" : "pending";
                const Icon = STATUS_STYLE[s].icon;
                return (
                  <li key={s} aria-current={state === "current" ? "step" : undefined} className="relative flex gap-3 sm:flex-col sm:pr-4">
                    {i < STATUS_ORDER.length - 1 && (
                      <span aria-hidden="true" className={cn("absolute top-4 left-8 hidden h-0.5 w-[calc(100%-2rem)] sm:block", i < idx ? "bg-primary" : "bg-border")} />
                    )}
                    <span
                      className={cn(
                        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2",
                        state === "done" && "border-primary bg-primary text-primary-foreground",
                        state === "current" && "border-primary bg-background text-primary ring-4 ring-primary/20",
                        state === "pending" && "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {state === "done" ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                    </span>
                    <div className="space-y-0.5">
                      <p className={cn("text-sm font-medium", state === "pending" && "text-muted-foreground")}>{ts(s)}</p>
                      <p className="text-xs text-muted-foreground">{t(`statusHelp.${s}`)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 bg-card p-4">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex flex-col-reverse">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-display text-lg font-bold tabular-nums">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Evidence */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">{t("example")}</CardTitle>
            </CardHeader>
            <CardContent>
              {c.sample ? (
                <div className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                    <MessageSquare className="size-4" />
                  </span>
                  <MaskedText text={c.sample} className="max-w-prose rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-[0.95rem]" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noExample")}</p>
              )}
            </CardContent>
          </Card>

          {c.weekly.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">{t("timeline")}</CardTitle>
                <CardDescription>{t("weeklyHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <WeeklyBars
                  data={c.weekly.map((w) => ({ week: fmtDate(w.week, locale, "d MMM"), count: w.count }))}
                  label={t("messages")}
                  summary={`${t("timelineSr")} ${c.weekly.map((w) => `${fmtDate(w.week, locale)}: ${w.count}`).join("; ")}`}
                />
              </CardContent>
            </Card>
          )}

          {domains.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">{t("domains")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {domains.map((d) => (
                    <li key={d} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <Globe className="size-4 shrink-0 text-flag-red" aria-hidden="true" />
                      <DefangedText value={d} revealable={false} className="min-w-0 flex-1" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {c.advisories.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-medium">{t("advisories")}</h2>
              {c.advisories.map((a) => (
                <Card key={a.slug} className="gap-2">
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-2"><Megaphone className="size-4 text-primary" aria-hidden="true" />{l === "en" ? a.title_en : a.title_sq}</CardTitle>
                    <CardDescription>{fmtDate(a.published_at, locale)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{l === "en" ? a.body_en : a.body_sq}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </div>

        {/* Guidance: stays in view on wide screens */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-flag-orange/40 bg-flag-orange/5 ring-flag-orange/30">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 font-display text-lg">
                <TriangleAlert className="size-5 text-flag-orange" aria-hidden="true" />
                {t("whatToDo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2.5">
                {(t.raw("todoItems") as string[]).map((s, i) => (
                  <li key={s} className="flex gap-3 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-flag-orange/15 text-xs font-semibold text-flag-orange" aria-hidden="true">{i + 1}</span>
                    <span className="pt-0.5">{s.replace("{institution}", inst)}</span>
                  </li>
                ))}
              </ol>
              <Button asChild className="w-full">
                <Link href="/report">{t("reportCta")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 font-display text-lg">
                <CircleAlert className="size-5 text-primary" aria-hidden="true" />
                {t("recognise")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {(t.raw("recogniseItems") as string[]).map((s) => (
                  <li key={s} className="flex gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{s.replace("{institution}", inst)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </article>
  );
}

export default function PublicCampaignPage({ params }: { params: Params }) {
  return (
    <div className={cn(WIDE, "pt-8 pb-20 md:pt-10")}>
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-80 w-full rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-64 rounded-xl lg:col-span-2" /><Skeleton className="h-64 rounded-xl" /></div>
          </div>
        }
      >
        <CampaignView params={params} />
      </Suspense>
    </div>
  );
}
