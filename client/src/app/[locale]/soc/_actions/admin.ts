"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { tryAdmin } from "@/server/db";
import { hostOf } from "@/server/detection/normalize";

const role = z.enum(["user", "soc_analyst", "soc_lead", "platform_admin"]);

/** Role changes only by platform_admin (SPEC 15.1), audited. */
export async function changeRole(input: unknown) {
  return staffAction("platform_admin", z.object({ userId: z.uuid(), role }), input, async ({ userId, role }, ctx) => {
    if (userId === ctx.user.id) throw new ActionError("conflict", "own role");
    const before = check(await ctx.supabase.from("profiles").select("platform_role").eq("id", userId).single());
    check(await ctx.supabase.from("profiles").update({ platform_role: role }).eq("id", userId));
    await audit({ actorId: ctx.user.id, action: "role.change", entity: "profile", entityId: userId, data: { from: before.platform_role, to: role } });
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

/** Staff cannot self-register: an admin invites them (Supabase invite email). */
export async function inviteStaff(input: unknown) {
  return staffAction("platform_admin", z.object({ email: z.email(), name: z.string().trim().min(2).max(120), role: role.exclude(["user"]) }), input, async (v, ctx) => {
    const db = tryAdmin();
    if (!db) throw new ActionError("conflict", "unavailable");
    const invited = await db.auth.admin.inviteUserByEmail(v.email, { data: { full_name: v.name } });
    if (invited.error || !invited.data.user) throw new ActionError("conflict", invited.error?.message);
    await db.from("profiles").update({ platform_role: v.role, full_name: v.name }).eq("id", invited.data.user.id);
    await audit({ actorId: ctx.user.id, action: "staff.invite", entity: "profile", entityId: invited.data.user.id, data: { role: v.role } });
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

export async function upsertInstitution(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid().optional(), name: z.string().trim().min(2).max(120), sector: z.enum(["government", "municipality", "bank", "postal", "utility", "telecom", "police", "other"]) }), input, async (v, ctx) => {
    const slug = v.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const row = v.id
      ? check(await ctx.supabase.from("institutions").update({ name: v.name, sector: v.sector }).eq("id", v.id).select("id").single())
      : check(await ctx.supabase.from("institutions").insert({ name: v.name, sector: v.sector, slug }).select("id").single(), "institution");
    await audit({ actorId: ctx.user.id, action: v.id ? "institution.update" : "institution.create", entity: "institution", entityId: row.id });
    updateTag("detection");
    updateTag("institutions");
    revalidatePath("/[locale]/soc/admin", "page");
    return row;
  });
}

export async function addOfficialDomain(input: unknown) {
  return staffAction("soc_lead", z.object({ institutionId: z.uuid(), domain: z.string().trim().min(3).max(253) }), input, async (v, ctx) => {
    const domain = hostOf(v.domain);
    if (!domain) throw new ActionError("invalid", "domain");
    check(await ctx.supabase.from("official_domains").insert({ institution_id: v.institutionId, domain }), "official domain");
    await audit({ actorId: ctx.user.id, action: "official_domain.add", entity: "institution", entityId: v.institutionId, data: { domain } });
    updateTag("detection");
    updateTag("institutions");
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

export async function removeOfficialDomain(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("official_domains").delete().eq("id", id));
    await audit({ actorId: ctx.user.id, action: "official_domain.remove", entity: "official_domain", entityId: id });
    updateTag("detection");
    updateTag("institutions");
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

export async function addOfficialChannel(input: unknown) {
  return staffAction("soc_lead", z.object({ institutionId: z.uuid(), kind: z.enum(["sms_sender", "phone", "social", "email"]), value: z.string().trim().min(2).max(120) }), input, async (v, ctx) => {
    check(await ctx.supabase.from("official_channels").insert({ institution_id: v.institutionId, kind: v.kind, value: v.value }), "channel");
    await audit({ actorId: ctx.user.id, action: "official_channel.add", entity: "institution", entityId: v.institutionId, data: { kind: v.kind } });
    updateTag("detection");
    updateTag("institutions");
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

export async function removeOfficialChannel(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("official_channels").delete().eq("id", id));
    await audit({ actorId: ctx.user.id, action: "official_channel.remove", entity: "official_channel", entityId: id });
    updateTag("detection");
    updateTag("institutions");
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

export async function saveTemplate(input: unknown) {
  return staffAction("soc_lead", z.object({ kind: z.enum(["registrar", "hosting", "akcesk"]), locale: z.enum(["sq", "en"]), subject: z.string().trim().min(3).max(300), body: z.string().trim().min(20).max(20000) }), input, async (v, ctx) => {
    const latest = check(await ctx.supabase.from("templates").select("version").eq("kind", v.kind).eq("locale", v.locale).order("version", { ascending: false }).limit(1));
    const version = (latest[0]?.version ?? 0) + 1;
    await ctx.supabase.from("templates").update({ active: false }).eq("kind", v.kind).eq("locale", v.locale);
    check(await ctx.supabase.from("templates").insert({ kind: v.kind, locale: v.locale, version, subject: v.subject, body: v.body, active: true }));
    await audit({ actorId: ctx.user.id, action: "template.save", entity: "template", entityId: `${v.kind}.${v.locale}`, data: { version } });
    revalidatePath("/[locale]/soc/admin", "page");
    return { version };
  });
}

export async function saveRecipient(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid().optional(), kind: z.enum(["registrar", "hosting", "akcesk"]), name: z.string().trim().min(2).max(120), abuse_email: z.email().refine((e) => /\.(example|test)$/i.test(e), "Demo recipients must use .example or .test addresses"), match_pattern: z.string().trim().max(120).optional(), sla_hours: z.number().int().min(1).max(720) }), input, async (v, ctx) => {
    const row = { kind: v.kind, name: v.name, abuse_email: v.abuse_email, match_pattern: v.match_pattern || null, sla_hours: v.sla_hours };
    const saved = v.id ? check(await ctx.supabase.from("recipients").update(row).eq("id", v.id).select("id").single()) : check(await ctx.supabase.from("recipients").insert(row).select("id").single());
    await audit({ actorId: ctx.user.id, action: "recipient.save", entity: "recipient", entityId: saved.id });
    revalidatePath("/[locale]/soc/admin", "page");
    return saved;
  });
}

export async function saveSetting(input: unknown) {
  return staffAction("platform_admin", z.object({ key: z.enum(["thresholds", "weights", "auto_escalate_hours"]), value: z.union([z.record(z.string(), z.number()), z.number()]) }), input, async ({ key, value }, ctx) => {
    check(await ctx.supabase.from("settings").upsert({ key, value, updated_by: ctx.user.id, updated_at: new Date().toISOString() }));
    await audit({ actorId: ctx.user.id, action: `settings.${key}`, entity: "settings", entityId: key, data: { value } });
    updateTag("detection");
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}
