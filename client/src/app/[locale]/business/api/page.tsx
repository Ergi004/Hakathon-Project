import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Activity, ChevronRight, KeyRound } from "lucide-react";
import { DashPage, EmptyPanel, StatCard } from "@/components/layout/dash";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { ApiKeyCreator, RevokeKeyButton } from "@/components/business/forms";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtAgo, fmtDate } from "@/lib/format";
import { nowMs } from "@/lib/time";
import { pageCount, pageParam, pageRange } from "@/lib/pagination";
import { Pager } from "@/components/shared/pager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as Locale, namespace: "business.nav" }))("api") };
}

const SNIPPETS = {
  cURL: `curl -X POST "$APP_URL/api/v1/scan" \\
  -H "Authorization: Bearer mbk_…" -H "Content-Type: application/json" \\
  -d '{"kind":"url","urls":["hxxps://x[.]example"],"channel":"sms","locale":"sq"}'`,
  Node: `const res = await fetch(\`\${process.env.APP_URL}/api/v1/scan\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.MBUROJA_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ kind: "text", text: message, channel: "sms", locale: "sq" }),
});
const { score, flag, reasons } = await res.json();`,
  PHP: `$ch = curl_init(getenv("APP_URL") . "/api/v1/scan");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("MBUROJA_KEY"), "Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode(["kind" => "url", "urls" => [$link], "channel" => "web", "locale" => "sq"]),
]);
$result = json_decode(curl_exec($ch), true);`,
};

const PAGE_SIZE = 10;
type SP = { page?: string };

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const page = pageParam((await searchParams).page);
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin"]));
  const [t, tb, locale] = await Promise.all([getTranslations("biz.api"), getTranslations("biz"), getLocale()]);
  // Stats and usage cover all keys; only the list below is paginated.
  const [{ data: allKeys }, { data: keys, count: keyTotal }] = await Promise.all([
    ctx.supabase.from("api_keys").select("id, revoked_at").eq("org_id", ctx.org.id),
    ctx.supabase.from("api_keys").select("id, name, prefix, scopes, last_used_at, revoked_at, created_at", { count: "exact" }).eq("org_id", ctx.org.id).order("created_at", { ascending: false }).order("id").range(...pageRange(page, PAGE_SIZE)),
  ]);
  const since = new Date(nowMs() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: usage } = (allKeys ?? []).length ? await ctx.supabase.from("api_usage").select("day, calls").in("key_id", (allKeys ?? []).map((k) => k.id)).gte("day", since) : { data: [] };
  const byDay = new Map<string, number>();
  for (const u of usage ?? []) byDay.set(u.day, (byDay.get(u.day) ?? 0) + u.calls);
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(nowMs() - (29 - i) * 86_400_000).toISOString().slice(0, 10); return { day: d, count: byDay.get(d) ?? 0 }; });
  const total = days.reduce((a, d) => a + d.count, 0);
  const active = (allKeys ?? []).filter((k) => !k.revoked_at).length;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <ul className="grid grid-cols-2 gap-3">
          <li><StatCard icon={KeyRound} label={tb("ap.activeKeys")} value={active} /></li>
          <li><StatCard icon={Activity} label={tb("ap.calls")} value={total} series={days.map((d) => d.count)} /></li>
        </ul>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b border-border py-5"><CardTitle className="font-display text-lg">{tb("ap.keys")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {!(keys ?? []).length ? (
              <EmptyPanel icon={KeyRound} title={t("empty")} />
            ) : (
              <>
              <ul className="divide-y divide-border">
                {keys!.map((k) => (
                  <li key={k.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-4 text-sm", k.revoked_at && "opacity-60")}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><KeyRound className="size-4" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{k.name}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{k.prefix}…</code>
                        {k.scopes.map((s) => <span key={s} className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px]">{s}</span>)}
                        {k.revoked_at && <Badge variant="destructive">{t("revoked")}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tb("ap.created", { date: fmtDate(k.created_at, locale) })} · {t("lastUsed")}: {k.last_used_at ? fmtAgo(k.last_used_at, locale) : t("never")}
                      </p>
                    </div>
                    {!k.revoked_at && <RevokeKeyButton id={k.id} />}
                  </li>
                ))}
              </ul>
              <div className="px-5 py-3 empty:hidden"><Pager page={page} pages={pageCount(keyTotal, PAGE_SIZE)} /></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">{t("usage")}</CardTitle></CardHeader>
          <CardContent>
            <WeeklyBars xKey="day" data={days.map((d) => ({ day: fmtDate(d.day, locale, "d MMM"), count: d.count }))} label={t("usage")} summary={t("usageSr", { summary: days.map((d) => `${d.day}: ${d.count}`).join("; ") })} />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-20 xl:col-span-4">
        <ApiKeyCreator />
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{t("snippets")}</CardTitle>
            <CardAction><Button asChild variant="ghost" size="sm"><Link href="/api-docs">{tb("ap.docs")}<ChevronRight className="size-4" aria-hidden="true" /></Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cURL">
              <TabsList>{Object.keys(SNIPPETS).map((k) => <TabsTrigger key={k} value={k} className="px-3">{k}</TabsTrigger>)}</TabsList>
              {Object.entries(SNIPPETS).map(([k, v]) => (
                <TabsContent key={k} value={k}>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-xl bg-muted p-4 pr-12 font-mono text-xs leading-relaxed">{v}</pre>
                    <div className="absolute top-2 right-2"><CopyButton value={v} /></div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tb] = await Promise.all([getTranslations("business.nav"), getTranslations("biz")]);
  return (
    <DashPage title={t("api")} subtitle={tb("pages.api")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
