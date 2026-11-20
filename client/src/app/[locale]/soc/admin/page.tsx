import { Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { UrlSearch } from "@/components/shared/url-search";
import { UrlTabs } from "@/components/shared/url-tabs";
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

type Search = Promise<{ action?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: (await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("admin") };
}

async function Content({ searchParams }: { searchParams: Search }) {
  const { action } = await searchParams;
  const ctx = await guardOrRedirect(() => requireRole("soc_lead"));
  const isAdmin = hasMinRole(ctx.profile.platform_role, "platform_admin");
  const [t, tr, tu, locale, tg] = await Promise.all([getTranslations("soc.admin"), getTranslations("roles"), getTranslations("ui"), getLocale(), getTranslations("geo.admin")]);
  const db = ctx.supabase;
  let auditQ = db.from("audit_log").select("id, created_at, action, entity, entity_id, actor:profiles!audit_log_actor_id_fkey(full_name)").order("created_at", { ascending: false }).limit(200);
  if (action) auditQ = auditQ.ilike("action", `${action.replace(/[%,]/g, "")}%`);
  const [users, insts, tpls, rcps, settings, audit, models, geoRules, regions] = await Promise.all([
    db.from("profiles").select("id, full_name, platform_role, created_at").order("platform_role", { ascending: false }).limit(500),
    db.from("institutions").select("id, name, sector, official_domains(id, domain), official_channels(id, kind, value)").order("name"),
    db.from("templates").select("kind, locale, version, subject, body, active").eq("active", true),
    db.from("recipients").select("id, kind, name, abuse_email, match_pattern, sla_hours").order("kind"),
    db.from("settings").select("key, value"),
    auditQ,
    db.from("model_versions").select("id, name, version, metrics, active, created_at").order("created_at", { ascending: false }),
    db.from("geo_alert_rules").select("id, name, min_reports, min_zscore, min_spike_ratio, active, institution_id, region_id").order("created_at"),
    db.from("regions").select("id, code"),
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
      <div className="overflow-x-auto rounded-xl border border-border">
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
    </div>
  );

  const auditTab = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <UrlSearch name="action" label={t("filterAction")} className="w-72" />
        <Button asChild variant="outline" size="sm"><a href={`/api/soc/export/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`}><Download className="size-3.5" aria-hidden="true" />{tu("exportCsv")}</a></Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
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
    </div>
  );

  return (
    <UrlTabs defaultTab="users" tabs={[
      { value: "users", label: t("tabs.users"), content: usersTab },
      { value: "institutions", label: t("tabs.institutions"), content: <div className="space-y-3"><NewInstitutionForm />{(insts.data ?? []).map((i) => <InstitutionCard key={i.id} inst={i} />)}</div> },
      { value: "templates", label: t("tabs.templates"), content: <TemplateEditor templates={tpls.data ?? []} /> },
      { value: "recipients", label: t("tabs.recipients"), content: <div className="space-y-2"><RecipientForm />{(rcps.data ?? []).map((r) => <RecipientForm key={r.id} r={r} />)}</div> },
      { value: "settings", label: t("tabs.settings"), content: <SettingsForm canEdit={isAdmin} thresholds={{ ...DEFAULT_THRESHOLDS, ...((setting("thresholds") as Record<string, number>) ?? {}) }} weights={(setting("weights") as Record<string, number>) ?? { links: 30, content: 25, sender: 25, attachments: 10, reputation: 10 }} autoEscalate={Number(setting("auto_escalate_hours") ?? 24)} /> },
      { value: "geo", label: tg("tab"), content: geoTab },
      { value: "audit", label: t("tabs.audit"), content: auditTab },
      { value: "models", label: t("tabs.models"), content: (
        <ul className="space-y-2">
          {(models.data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="font-mono">{m.name}@{m.version}</span>{m.active && <Badge>{t("active")}</Badge>}
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
  const t = await getTranslations("soc.nav");
  return (
    <div className="space-y-5">
      <PageHeader title={t("admin")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}><Content searchParams={searchParams} /></Suspense>
    </div>
  );
}
