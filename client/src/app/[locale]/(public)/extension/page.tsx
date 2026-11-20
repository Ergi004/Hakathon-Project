import { ArrowDown, Check, Download, EyeOff, FolderOpen, KeyRound, Mail, ScanSearch, Send, ShieldAlert, ShieldCheck, ToggleRight, Trash2 } from "lucide-react";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FlagBadge } from "@/components/flags/flag-badge";
import { WIDE } from "@/components/home/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { FlagLevel } from "@/lib/flags";
import { cn } from "@/lib/utils";

const STEP_ICONS = [Download, ToggleRight, FolderOpen, ScanSearch] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "extensionPage" });
  return { title: t("title"), description: t("description") };
}

/** Static illustration of the extension on an email. Synthetic and defanged. */
async function ExtensionMock() {
  const t = await getTranslations("extensionPage");
  return (
    <figure aria-label={t("mock.label")} className="relative mx-auto w-full max-w-lg">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-40px_oklch(0_0_0/0.5)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-flag-red/60" />
          <span className="size-2.5 rounded-full bg-flag-yellow/60" />
          <span className="size-2.5 rounded-full bg-flag-green/60" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-background/70" />
        </div>
        {/* Email */}
        <div className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="font-medium">{t("mock.from")}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{t("mock.address")}</p>
            </div>
          </div>
          <p className="font-display font-medium">{t("mock.subject")}</p>
          <div className="space-y-1.5" aria-hidden="true">
            <span className="block h-2 w-full rounded-full bg-muted" />
            <span className="block h-2 w-11/12 rounded-full bg-muted" />
            <span className="block h-2 w-2/3 rounded-full bg-muted" />
          </div>
          <Button size="sm" className="pointer-events-none mt-1 rounded-full" tabIndex={-1}>
            <ScanSearch className="size-4" aria-hidden="true" />
            {t("mock.scan")}
          </Button>
        </div>
      </div>
      {/* Result popup */}
      <div className="relative -mt-6 ml-auto w-[85%] rounded-2xl border border-flag-red/40 bg-card p-4 shadow-xl sm:-mr-6">
        <FlagBadge flag="red" score={74} />
        <ul className="mt-3 space-y-1.5 text-sm">
          {[t("mock.reason1"), t("mock.reason2")].map((r) => (
            <li key={r} className="flex gap-2">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-flag-red" aria-hidden="true" />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export default async function ExtensionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("extensionPage");
  const hasZip = existsSync(path.join(process.cwd(), "public", "downloads", "mburoja-extension.zip"));
  const list = (key: string) => t.raw(key) as string[];

  const sends: { flags: FlagLevel[]; label: string; tone: string }[] = [
    { flags: ["orange", "red", "darkred"], label: t("sendReport"), tone: "text-flag-red" },
    { flags: ["yellow"], label: t("sendIndicators"), tone: "text-flag-yellow" },
    { flags: ["green", "grey"], label: t("sendNothing"), tone: "text-muted-foreground" },
  ];

  return (
    <div className={cn(WIDE, "space-y-16 pt-10 pb-20 md:pt-14")}>
      {/* Hero */}
      <header className="grid items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <Mail aria-hidden="true" />
            {t("worksWith")}
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">{t("title")}</h1>
          <p className="max-w-[52ch] text-lg text-muted-foreground">{t("description")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {hasZip && (
              <Button asChild size="lg" className="rounded-full">
                <a href="/downloads/mburoja-extension.zip" download><Download className="size-4" aria-hidden="true" />{t("download")}</a>
              </Button>
            )}
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href="#install"><ArrowDown className="size-4" aria-hidden="true" />{t("howInstall")}</a>
            </Button>
          </div>
        </div>
        <ExtensionMock />
      </header>

      {/* Installation: a real four-step sequence */}
      <section id="install" aria-labelledby="install-title" className="scroll-mt-24 space-y-6">
        <div className="space-y-2">
          <h2 id="install-title" className="font-display text-3xl font-bold tracking-tight">{t("install")}</h2>
          <p className="text-muted-foreground">{t("downloadNote")}</p>
        </div>
        <ol className="grid gap-6 md:grid-cols-4 md:gap-4">
          {list("installSteps").map((s, i) => {
            const Icon = STEP_ICONS[i] ?? Check;
            return (
              <li key={s} className="relative space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-primary/40 bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {i < 3 && <span aria-hidden="true" className="hidden flex-1 border-t-2 border-dashed border-border md:block" />}
                </div>
                <p className="text-sm">
                  <span className="mr-1.5 font-display font-bold text-muted-foreground">{i + 1}.</span>
                  {s}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Privacy: what it reads vs never reads */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="border-flag-green/30 ring-flag-green/20">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-display text-xl">
              <ShieldCheck className="size-5 text-flag-green" aria-hidden="true" />
              {t("reads")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {list("readsItems").map((s) => (
                <li key={s} className="flex gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-flag-green" aria-hidden="true" />{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-display text-xl">
              <EyeOff className="size-5 text-muted-foreground" aria-hidden="true" />
              {t("never")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {list("neverItems").map((s) => (
                <li key={s} className="flex gap-3 text-sm"><EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Consent: what gets sent for each result */}
      <section aria-labelledby="consent-title" className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <h2 id="consent-title" className="font-display text-3xl font-bold tracking-tight">{t("consent")}</h2>
          <p className="text-muted-foreground">{t("consentIntro")}</p>
          <p className="flex items-center gap-2 text-sm"><Trash2 className="size-4 text-primary" aria-hidden="true" />{t("deleteWindow")}</p>
          <Button asChild variant="outline" className="mt-2 rounded-full"><Link href="/citizen/extension">{t("manage")}</Link></Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card lg:col-span-8">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4">{t("colResult")}</TableHead>
                <TableHead className="pr-4">{t("colSent")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sends.map((row) => (
                <TableRow key={row.label} className="hover:bg-transparent">
                  <TableCell className="pl-4">
                    <div className="flex flex-wrap gap-1.5">
                      {row.flags.map((f) => <FlagBadge key={f} flag={f} />)}
                    </div>
                  </TableCell>
                  <TableCell className={cn("pr-4 font-medium whitespace-normal", row.tone === "text-muted-foreground" && "text-muted-foreground")}>
                    <span className="inline-flex items-center gap-2">
                      <Send className={cn("size-4 shrink-0", row.tone)} aria-hidden="true" />
                      {row.label}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Technical detail */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-display text-lg"><Send className="size-5 text-primary" aria-hidden="true" />{t("signal")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {list("signalItems").map((s) => (
                <li key={s} className="flex gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-display text-lg"><KeyRound className="size-5 text-primary" aria-hidden="true" />{t("permissions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {list("permissionsItems").map((s) => {
                const [name, ...rest] = s.split(":");
                return (
                  <li key={s} className="flex gap-3 text-sm">
                    <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {rest.length ? (
                      <span><code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{name}</code>{":" + rest.join(":")}</span>
                    ) : (
                      s
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
