import { Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { DashPage } from "@/components/layout/dash";
import { UrlSearch } from "@/components/shared/url-search";
import { Pager } from "@/components/shared/pager";
import { UrlTabs } from "@/components/shared/url-tabs";
import { pageCount, pageParam, pageRange } from "@/lib/pagination";
import { InstitutionCard, InviteForm, NewInstitutionForm, RecipientForm, RoleSelect, SettingsForm, TemplateEditor } from "@/components/soc/admin-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_THRESHOLDS } from "@/lib/flags";
import { fmtDateTime } from "@/lib/format";
import { guardOrRedirect, hasMinRole, requireRole } from "@/server/auth";
import { GeoAdmin } from "@/components/geo/GeoAdmin";
import { parseThresholds } from "@/server/geo/hotspots";

type Search = Promise<{ action?: string; tab?: string; page?: string }>;
const TABS = ["users", "institutions", "templates", "recipients", "settings", "geo", "audit", "models"] as const;
const PAGE_SIZE = 50;
const none = Promise.resolve({ data: null, count: null });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("admin") };
}

async function Content({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { action } = sp;
  // Only the visible tab is queried and rendered; switching tabs re-renders with ?tab=.
  const tab = TABS.find((x) => x === sp.tab) ?? "users";
  const page = pageParam(sp.page);
  const on = (...keys: (typeof TABS)[number][]) => keys.includes(tab);
  const ctx = await guardOrRedirect(() => requireRole("soc_lead"));
  const isAdmin = hasMinRole(ctx.profile.platform_role, "platform_admin");
  const [t, tr, tu, locale, tg] = await Promise.all([getTranslations("soc.admin"), getTranslations("roles"), getTranslations("ui"), getLocale(), getTranslations("geo.admin")]);
  const db = ctx.supabase;
  let auditQ = db.from("audit_log").select("id, created_at, action, entity, entity_id, actor:profiles!audit_log_actor_id_fkey(full_name)", { count: "exact" }).order("created_at", { ascending: false }).range(...pageRange(page, PAGE_SIZE));
  if (action) auditQ = auditQ.ilike("action", `${action.replace(/[%,]/g, "")}%`);
  const [users, insts, tpls, rcps, settings, audit, models, geoRules, regions] = await Promise.all([
    on("users") ? db.from("profiles").select("id, full_name, platform_role, created_at", { count: "exact" }).order("platform_role", { ascending: false }).order("created_at", { ascending: false }).range(...pageRange(page, PAGE_SIZE)) : none,
    on("institutions", "geo") ? db.from("institutions").select("id, name, sector, official_domains(id, domain), official_channels(id, kind, value)").order("name") : none,
    on("templates") ? db.from("templates").select("kind, locale, version, subject, body, active").eq("active", true) : none,
    on("recipients") ? db.from("recipients").select("id, kind, name, abuse_email, match_pattern, sla_hours").order("kind") : none,
    on("settings", "geo") ? db.from("settings").select("key, value") : none,
    on("audit") ? auditQ : none,
    on("models") ? db.from("model_versions").select("id, name, version, metrics, active, created_at").order("created_at", { ascending: false }) : none,
    on("geo") ? db.from("geo_alert_rules").select("id, name, min_reports, min_zscore, min_spike_ratio, active, institution_id, region_id").order("created_at") : none,
    on("geo") ? db.from("regions").select("id, code") : none,
  ]);
  const setting = (k: string) => settings.data?.find((s) => s.key === k)?.value;
  const regionCode = new Map((regions.data ?? []).map((r) => [r.id, r.code]));
  const instNames = new Map((insts.data ?? []).map((i) => [i.id, i.name]));
  const geoTab = (
    <GeoAdmin
      thresholds={parseThresholds(setting("geo_thresholds"))}
      institutions={(insts.data ?? []).map((i) => ({ id: i.id, name: i.name }))}
      rules={(geoRules.data ?? []).map((r) => ({ id: r.id, name: r.name, min_reports: r.min_reports, min_zscore: Number(r.min_zscore), min_spike_ratio: Number(r.min_spike_ratio), active: r.active, institution: r.institution_id ? instNames.get(r.institution_id) ?? null : null, regionCode: r.region_id ? regionCode.get(r.region_id) ?? null : null }))}
    />
  );

  const usersTab = (
    <div className="space-y-4">
      <Alert><ShieldCheck className="size-4" /><AlertDescription>{t("mfaRequired")}</AlertDescription></Alert>
      {isAdmin ? <InviteForm /> : <p className="text-sm text-muted-foreground">{t("adminOnly")}</p>}
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
        <Table>
          <TableHeader><TableRow><TableHead>{t("name")}</TableHead><TableHead>{t("role")}</TableHead><TableHead className="hidden md:table-cell">{t("when")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(users.data ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-sm">{u.full_name ?? <span className="font-mono text-xs">{u.id.slice(0, 8)}</span>}</TableCell>
                <TableCell>{isAdmin ? <RoleSelect userId={u.id} role={u.platform_role} disabled={u.id === ctx.user.id} /> : <Badge variant="outline">{tr(u.platform_role)}</Badge>}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{fmtDateTime(u.created_at, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager page={page} pages={pageCount(users.count, PAGE_SIZE)} />
    </div>
  );

  const auditTab = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <UrlSearch name="action" label={t("filterAction")} className="w-72" />
        <Button asChild variant="outline" size="sm"><a href={`/api/soc/export/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`}><Download className="size-3.5" aria-hidden="true" />{tu("exportCsv")}</a></Button>
      </div>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
        <Table>
          <TableHeader><TableRow><TableHead>{t("when")}</TableHead><TableHead>{t("action")}</TableHead><TableHead>{t("entity")}</TableHead><TableHead className="hidden md:table-cell">{t("actor")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {(audit.data ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(a.created_at, locale)}</TableCell>
                <TableCell className="font-mono text-xs">{a.action}</TableCell>
                <TableCell className="text-xs">{a.entity}{a.entity_id ? <span className="font-mono text-muted-foreground"> · {a.entity_id.slice(0, 8)}</span> : null}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{(a.actor as { full_name: string | null } | null)?.full_name ?? "system"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pager page={page} pages={pageCount(audit.count, PAGE_SIZE)} />
    </div>
  );

  return (
    <UrlTabs defaultTab="users" tabs={[
      { value: "users", label: t("tabs.users"), content: on("users") ? usersTab : null },
      { value: "institutions", label: t("tabs.institutions"), content: on("institutions") ? <div className="space-y-3"><NewInstitutionForm />{(insts.data ?? []).map((i) => <InstitutionCard key={i.id} inst={i} />)}</div> : null },
      { value: "templates", label: t("tabs.templates"), content: on("templates") ? <TemplateEditor templates={tpls.data ?? []} /> : null },
      { value: "recipients", label: t("tabs.recipients"), content: on("recipients") ? <div className="space-y-2"><RecipientForm />{(rcps.data ?? []).map((r) => <RecipientForm key={r.id} r={r} />)}</div> : null },
      { value: "settings", label: t("tabs.settings"), content: !on("settings") ? null : <SettingsForm canEdit={isAdmin} thresholds={{ ...DEFAULT_THRESHOLDS, ...((setting("thresholds") as Record<string, number>) ?? {}) }} weights={(setting("weights") as Record<string, number>) ?? { links: 30, content: 25, sender: 25, attachments: 10, reputation: 10 }} autoEscalate={Number(setting("auto_escalate_hours") ?? 24)} /> },
      { value: "geo", label: tg("tab"), content: on("geo") ? geoTab : null },
      { value: "audit", label: t("tabs.audit"), content: on("audit") ? auditTab : null },
      { value: "models", label: t("tabs.models"), content: !on("models") ? null : (
        <ul className="space-y-3">
          {(models.data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
              <span className="font-mono font-medium">{m.name}@{m.version}</span>{m.active && <Badge>{t("active")}</Badge>}
              <code className="text-xs text-muted-foreground">{JSON.stringify(m.metrics).slice(0, 120)}</code>
              <span className="ml-auto text-xs text-muted-foreground">{fmtDateTime(m.created_at, locale)}</span>
            </li>
          ))}
        </ul>
      ) },
    ]} />
  );
}

export default async function SocAdminPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  setRequestLocale((await params).locale as Locale);
  const [t, tx] = await Promise.all([getTranslations("soc.nav"), getTranslations("socx")]);
  return (
    <DashPage title={t("admin")} subtitle={tx("pages.admin")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}><Content searchParams={searchParams} /></Suspense>
    </DashPage>
  );
}
