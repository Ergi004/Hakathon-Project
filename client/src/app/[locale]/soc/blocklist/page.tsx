import { Clock, Download, ListX, ShieldBan } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { BlocklistForm, RemoveBlocklistButton } from "@/components/soc/blocklist-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { nowMs } from "@/lib/time";
import { requireRole } from "@/server/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("blocklist") };
}

async function List_() {
  const ctx = await requireRole("soc_analyst");
  const [t, ti, tx, locale] = await Promise.all([getTranslations("soc.blocklist"), getTranslations("ioc.types"), getTranslations("socx"), getLocale()]);
  const { data } = await ctx.supabase.from("blocklist_entries").select("id, type, value, reason, expires_at, created_at, campaigns(code)").order("created_at", { ascending: false }).limit(1000);
  const now = nowMs();
  const all = data ?? [];
  const expiredN = all.filter((b) => b.expires_at && Date.parse(b.expires_at) < now).length;
  return (
    <div className="space-y-6">
    <ul className="grid grid-cols-3 gap-3">
      <li><StatCard icon={ListX} label={tx("bl.total")} value={all.length} /></li>
      <li><StatCard icon={ShieldBan} tone="text-flag-red" label={tx("bl.active")} value={all.length - expiredN} /></li>
      <li><StatCard icon={Clock} tone="text-muted-foreground" label={tx("bl.expired")} value={expiredN} /></li>
    </ul>
    <BlocklistForm />
    {!all.length ? <div className="rounded-xl bg-card ring-1 ring-foreground/10"><EmptyPanel icon={ShieldBan} title={t("empty")} /></div> : (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
      <Table>
        <TableHeader><TableRow><TableHead>{t("type")}</TableHead><TableHead>{t("value")}</TableHead><TableHead className="hidden md:table-cell">{t("reason")}</TableHead><TableHead>{t("expires")}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
        <TableBody>
          {all.map((b) => {
            const shown = b.value.replace(/^http/i, "hxxp").replace(/(?<!\[)\.(?!\])/g, "[.]");
            const expired = b.expires_at && Date.parse(b.expires_at) < now;
            return (
              <TableRow key={b.id} className={expired ? "opacity-60" : undefined}>
                <TableCell><Badge variant="secondary">{ti(b.type)}</Badge></TableCell>
                <TableCell className="max-w-80 truncate font-mono text-xs">{shown}{b.campaigns && <span className="ml-2 text-muted-foreground">({(b.campaigns as { code: string }).code})</span>}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{b.reason ?? "—"}</TableCell>
                <TableCell className="text-xs">{b.expires_at ? fmtDate(b.expires_at, locale) : t("never")}</TableCell>
                <TableCell><RemoveBlocklistButton id={b.id} label={shown} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    )}
    </div>
  );
}

export default async function BlocklistPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("soc.blocklist"), getTranslations("socx")]);
  return (
    <DashPage title={t("blocklist")} subtitle={tx("pages.blocklist")} actions={<Button asChild variant="outline" className="rounded-full"><a href="/api/soc/export/blocklist"><Download className="size-4" aria-hidden="true" />{tb("export")}</a></Button>}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><List_ /></Suspense>
    </DashPage>
  );
}
