"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { DEFAULT_THRESHOLDS, flagForScore } from "@/lib/flags";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { hostOf } from "@/server/detection/normalize";

const iocType = z.enum(["domain", "url", "ip", "cert", "phone", "email", "file_hash"]);

/* A6 domains */
export async function setDomainStatus(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), status: z.enum(["watching", "threat", "dismissed", "taken_down", "allowlisted"]) }), input, async ({ id, status }, ctx) => {
    const d = check(await ctx.supabase.from("domains").select("domain, status").eq("id", id).single());
    check(await ctx.supabase.from("domains").update({ status }).eq("id", id));
    if (status === "threat") await ctx.supabase.from("blocklist_entries").upsert({ type: "domain", value: d.domain, reason: "Marked threat in domain intelligence", created_by: ctx.user.id }, { onConflict: "type,value", ignoreDuplicates: true });
    await audit({ actorId: ctx.user.id, action: "domain.status", entity: "domain", entityId: id, data: { from: d.status, to: status } });
    revalidatePath("/[locale]/soc/domains", "page");
    updateTag("detection");
    return null;
  });
}

/* A12 blocklist */
export async function addBlocklistEntry(input: unknown) {
  return staffAction("soc_analyst", z.object({ type: iocType, value: z.string().trim().min(3).max(2048), reason: z.string().trim().max(500).optional(), expiresAt: z.string().optional(), campaignId: z.uuid().optional() }), input, async (v, ctx) => {
    const value = v.type === "domain" ? hostOf(v.value) ?? v.value.toLowerCase() : v.value.replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http");
    check(await ctx.supabase.from("blocklist_entries").upsert({ type: v.type, value, reason: v.reason || null, expires_at: v.expiresAt ? new Date(v.expiresAt).toISOString() : null, campaign_id: v.campaignId ?? null, created_by: ctx.user.id }, { onConflict: "type,value" }), "blocklist");
    await audit({ actorId: ctx.user.id, action: "blocklist.add", entity: "blocklist", data: { type: v.type, value } });
    revalidatePath("/[locale]/soc/blocklist", "page");
    updateTag("detection");
    return null;
  });
}

export async function removeBlocklistEntry(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("blocklist_entries").delete().eq("id", id));
    await audit({ actorId: ctx.user.id, action: "blocklist.remove", entity: "blocklist", entityId: id });
    revalidatePath("/[locale]/soc/blocklist", "page");
    updateTag("detection");
    return null;
  });
}

/* A11 advisories: analysts draft, leads publish (RLS + guard) */
const advisorySchema = z.object({
  id: z.uuid().optional(),
  campaignId: z.uuid().nullable().optional(),
  title_sq: z.string().trim().min(3).max(200),
  title_en: z.string().trim().min(3).max(200),
  body_sq: z.string().trim().min(10).max(8000),
  body_en: z.string().trim().min(10).max(8000),
  severity: z.enum(["low", "medium", "high", "critical"]),
});
export async function saveAdvisory(input: unknown) {
  return staffAction("soc_analyst", advisorySchema, input, async (v, ctx) => {
    const slug = `${v.title_en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}-${Date.now().toString(36)}`;
    const row = { title_sq: v.title_sq, title_en: v.title_en, body_sq: v.body_sq, body_en: v.body_en, severity: v.severity, campaign_id: v.campaignId ?? null };
    const saved = v.id
      ? check(await ctx.supabase.from("advisories").update(row).eq("id", v.id).neq("status", "published").select("id").single())
      : check(await ctx.supabase.from("advisories").insert({ ...row, slug, created_by: ctx.user.id }).select("id").single());
    await audit({ actorId: ctx.user.id, action: v.id ? "advisory.update" : "advisory.create", entity: "advisory", entityId: saved.id });
    revalidatePath("/[locale]/soc/advisories", "page");
    return saved;
  });
}

export async function setAdvisoryStatus(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), status: z.enum(["draft", "in_review", "published"]) }), input, async ({ id, status }, ctx) => {
    const lead = ["soc_lead", "platform_admin"].includes(ctx.profile.platform_role);
    if (status === "published" && !lead) throw new ActionError("forbidden");
    const a = check(await ctx.supabase.from("advisories").select("created_by").eq("id", id).single());
    if (status === "published" && a.created_by === ctx.user.id) throw new ActionError("conflict", "four-eyes");
    check(await ctx.supabase.from("advisories").update({ status, ...(status === "published" ? { published_at: new Date().toISOString(), approved_by: ctx.user.id } : {}) }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: `advisory.${status}`, entity: "advisory", entityId: id });
    revalidatePath("/[locale]/soc/advisories", "page");
    updateTag("feed");
    return null;
  });
}

/* A14 alert rules (lead) */
const ruleSchema = z.object({
  name: z.string().trim().min(3).max(80),
  metric: z.enum(["reports_per_hour", "reports_per_day", "high_risk_per_hour", "new_domains_per_day"]),
  op: z.enum([">", ">=", "<"]),
  value: z.number().int().min(0).max(100000),
  institution: z.string().trim().max(120).optional(),
  channel: z.enum(["in_app", "email"]),
});
export async function createAlertRule(input: unknown) {
  return staffAction("soc_lead", ruleSchema, input, async (v, ctx) => {
    const row = check(await ctx.supabase.from("alert_rules").insert({ name: v.name, condition: { metric: v.metric, op: v.op, value: v.value, institution: v.institution || null }, channel: v.channel, created_by: ctx.user.id }).select("id").single());
    await audit({ actorId: ctx.user.id, action: "alert_rule.create", entity: "alert_rule", entityId: row.id });
    revalidatePath("/[locale]/soc/alerts", "page");
    return row;
  });
}
export async function toggleAlertRule(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid(), active: z.boolean() }), input, async ({ id, active }, ctx) => {
    check(await ctx.supabase.from("alert_rules").update({ active }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: "alert_rule.toggle", entity: "alert_rule", entityId: id, data: { active } });
    revalidatePath("/[locale]/soc/alerts", "page");
    return null;
  });
}
export async function deleteAlertRule(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("alert_rules").delete().eq("id", id));
    await audit({ actorId: ctx.user.id, action: "alert_rule.delete", entity: "alert_rule", entityId: id });
    revalidatePath("/[locale]/soc/alerts", "page");
    return null;
  });
}

/* A13 quality */
const thresholds = z.object({ yellow: z.number().int().min(1).max(99), orange: z.number().int().min(1).max(99), red: z.number().int().min(1).max(99), darkred: z.number().int().min(1).max(100) }).refine((t) => t.yellow < t.orange && t.orange < t.red && t.red < t.darkred, { message: "order" });

export async function simulateThresholds(input: unknown) {
  return staffAction("soc_lead", thresholds, input, async (t, ctx) => {
    const { data } = await ctx.supabase.from("messages").select("score").not("score", "is", null).limit(20000);
    let changed = 0;
    const dist: Record<string, number> = { green: 0, yellow: 0, orange: 0, red: 0, darkred: 0 };
    for (const m of data ?? []) {
      const now = flagForScore(m.score!, DEFAULT_THRESHOLDS);
      const next = flagForScore(m.score!, t);
      dist[next] += 1;
      if (now !== next) changed += 1;
    }
    return { changed, total: data?.length ?? 0, dist };
  });
}

export async function saveThresholds(input: unknown) {
  return staffAction("platform_admin", thresholds, input, async (t, ctx) => {
    check(await ctx.supabase.from("settings").upsert({ key: "thresholds", value: t, updated_by: ctx.user.id, updated_at: new Date().toISOString() }));
    await audit({ actorId: ctx.user.id, action: "settings.thresholds", entity: "settings", entityId: "thresholds", data: t });
    updateTag("detection");
    revalidatePath("/[locale]/soc/quality", "page");
    return null;
  });
}

export async function labelFeedback(input: unknown) {
  return staffAction("soc_analyst", z.object({ reportId: z.uuid(), actual: z.enum(["phishing", "legitimate"]) }), input, async ({ reportId, actual }, ctx) => {
    const r = check(await ctx.supabase.from("reports").select("flag, message_id").eq("id", reportId).single());
    check(await ctx.supabase.from("feedback_labels").insert({ report_id: reportId, message_id: r.message_id, analyst_id: ctx.user.id, predicted: r.flag && ["orange", "red", "darkred"].includes(r.flag) ? "phishing" : "legitimate", actual }));
    if (r.message_id) await ctx.supabase.from("messages").update({ label: actual }).eq("id", r.message_id);
    await audit({ actorId: ctx.user.id, action: "feedback.label", entity: "report", entityId: reportId, data: { actual } });
    return null;
  });
}
