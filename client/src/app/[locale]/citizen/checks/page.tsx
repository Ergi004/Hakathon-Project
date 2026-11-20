import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CircleCheck, Link2, Mail, MessageSquare, Phone, QrCode, ScanSearch, ShieldAlert, type LucideIcon } from "lucide-react";
import { DeleteCheckButton, SaveHistoryToggle } from "@/components/citizen/forms";
import { FlagBadge } from "@/components/flags/flag-badge";
import { UrlToggle } from "@/components/shared/url-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { flagForScore, type FlagLevel } from "@/lib/flags";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";

const KIND_ICON: Record<string, LucideIcon> = { url: Link2, text: MessageSquare, phone: Phone, qr: QrCode, email_signals: Mail };
const RISKY: FlagLevel[] = ["orange", "red", "darkred"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "citizen.nav" }))("checks") };
}

async function Content({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await requireUser();
  const [{ show }, t, locale] = await Promise.all([searchParams, getTranslations("cit.checks"), getLocale()]);
  const { data } = await ctx.supabase.from("user_check_links").select("check_id, kind, created_at, checks(score, flag)").eq("user_id", ctx.user.id).order("created_at", { ascending: false }).limit(500);
  const rows = (data ?? []).map((r) => {
    const c = r.checks as { score: number; flag: FlagLevel | null } | null;
    return { ...r, score: c?.score ?? null, flag: c ? (c.flag ?? flagForScore(c.score)) : null };
  });

  if (!rows.length) {
    return (
      <div className="space-y-6">
        <SaveHistoryToggle on={ctx.profile.save_history} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-primary/10"><ScanSearch className="size-7 text-primary" aria-hidden="true" /></span>
            <p className="font-display text-xl font-medium">{t("empty")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("emptyBody")}</p>
            <Button asChild className="mt-2 rounded-full"><Link href="/check">{t("checkNow")}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const risky = rows.filter((r) => r.flag && RISKY.includes(r.flag)).length;
  const safe = rows.filter((r) => r.flag === "green").length;
  const view = show === "risky" || show === "safe" ? show : "all";
  const shown = view === "all" ? rows : rows.filter((r) => (view === "risky" ? r.flag && RISKY.includes(r.flag) : r.flag === "green"));
  const stats = [
    { k: "total", v: rows.length, Icon: ScanSearch, tone: "text-primary" },
    { k: "risky", v: risky, Icon: ShieldAlert, tone: "text-flag-red" },
    { k: "safe", v: safe, Icon: CircleCheck, tone: "text-flag-green" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <SaveHistoryToggle on={ctx.profile.save_history} />
        <ul className="grid grid-cols-3 gap-3">
          {stats.map(({ k, v, Icon, tone }) => (
            <li key={k}>
              <Card className="h-full justify-center py-4">
                <CardContent className="flex items-center gap-3 px-4">
                  <Icon className={cn("size-5 shrink-0", tone)} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-display text-2xl leading-none font-bold">{v}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{t(`stats.${k}`)}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UrlToggle name="show" label={t("filter")} options={(["all", "risky", "safe"] as const).map((f) => ({ value: f, label: t(`filters.${f}`) }))} />
        <DeleteCheckButton all count={rows.length} />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {!shown.length ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{t("noneInFilter")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-5">{t("kind")}</TableHead>
                <TableHead>{t("result")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("date")}</TableHead>
                <TableHead className="pr-5"><span className="sr-only">{t("open")}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const Icon = KIND_ICON[r.kind] ?? ScanSearch;
                const risk = r.flag && RISKY.includes(r.flag);
                return (
                  <TableRow key={r.check_id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-3">
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", risk ? "bg-flag-red/12 text-flag-red" : "bg-muted text-muted-foreground")}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium">{t(`kinds.${r.kind as "url"}`)}</p>
                          <p className="text-xs text-muted-foreground md:hidden">{fmtAgo(r.created_at, locale)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{r.flag && <FlagBadge flag={r.flag} score={r.score ?? undefined} />}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      <time dateTime={r.created_at} title={fmtDateTime(r.created_at, locale)}>{fmtAgo(r.created_at, locale)}</time>
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="outline" className="h-8 rounded-full"><Link href={`/check/${r.check_id}`}>{t("open")}</Link></Button>
                        <DeleteCheckButton id={r.check_id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function ChecksSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ show?: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("cit.checks");
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild className="self-start rounded-full md:self-auto"><Link href="/check"><ScanSearch className="size-4" aria-hidden="true" />{t("checkNow")}</Link></Button>
      </header>
      <Suspense fallback={<ChecksSkeleton />}><Content searchParams={searchParams} /></Suspense>
    </div>
  );
}
