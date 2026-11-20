import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { guardOrRedirect, requireActiveOrg } from "@/server/auth";
import { ApiKeyCreator, RevokeKeyButton } from "@/components/business/forms";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtAgo, fmtDate } from "@/lib/format";
import { nowMs } from "@/lib/time";

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

async function Content() {
  const ctx = await guardOrRedirect(() => requireActiveOrg(["owner", "admin"]));
  const [t, locale] = await Promise.all([getTranslations("biz.api"), getLocale()]);
  const { data: keys } = await ctx.supabase.from("api_keys").select("id, name, prefix, scopes, last_used_at, revoked_at, created_at").eq("org_id", ctx.org.id).order("created_at", { ascending: false });
  const since = new Date(nowMs() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: usage } = (keys ?? []).length ? await ctx.supabase.from("api_usage").select("day, calls").in("key_id", (keys ?? []).map((k) => k.id)).gte("day", since) : { data: [] };
  const byDay = new Map<string, number>();
  for (const u of usage ?? []) byDay.set(u.day, (byDay.get(u.day) ?? 0) + u.calls);
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(nowMs() - (29 - i) * 86_400_000).toISOString().slice(0, 10); return { day: d, count: byDay.get(d) ?? 0 }; });
  return (
    <div className="space-y-6">
      <ApiKeyCreator />
      <ul className="space-y-2">
        {!(keys ?? []).length ? <li className="text-sm text-muted-foreground">{t("empty")}</li> : keys!.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
            <span className="font-medium">{k.name}</span><code className="text-xs">{k.prefix}…</code>
            {k.scopes.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
            {k.revoked_at && <Badge variant="destructive">{t("revoked")}</Badge>}
            <span className="ml-auto text-xs text-muted-foreground">{t("lastUsed")}: {k.last_used_at ? fmtAgo(k.last_used_at, locale) : t("never")}</span>
            {!k.revoked_at && <RevokeKeyButton id={k.id} />}
          </li>
        ))}
      </ul>
      <section className="glass-card space-y-2 rounded-xl p-4">
        <h2 className="font-medium">{t("usage")}</h2>
        <WeeklyBars xKey="day" data={days.map((d) => ({ day: fmtDate(d.day, locale, "d MMM"), count: d.count }))} label={t("usage")} summary={t("usageSr", { summary: days.map((d) => `${d.day}: ${d.count}`).join("; ") })} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">{t("snippets")}</h2>
        <Tabs defaultValue="cURL">
          <TabsList>{Object.keys(SNIPPETS).map((k) => <TabsTrigger key={k} value={k}>{k}</TabsTrigger>)}</TabsList>
          {Object.entries(SNIPPETS).map(([k, v]) => <TabsContent key={k} value={k}><pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs">{v}</pre></TabsContent>)}
        </Tabs>
      </section>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("business.nav");
  return (
    <div className="space-y-6">
      <PageHeader title={t("api")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content /></Suspense>
    </div>
  );
}
