"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, check, orgAction } from "@/server/action";
import { audit } from "@/server/audit";
import { ACTIVE_ORG_COOKIE, requireOrgRole, requireUser } from "@/server/auth";
import { tryAdmin } from "@/server/db";
import { hostOf } from "@/server/detection/normalize";
import { verifyDomainOwnership, verificationToken } from "@/server/domain-verify";
import { randomToken, sha256 } from "@/server/hash";
import { createReport } from "@/server/reports";

const MANAGE = ["owner", "admin"] as const;
const SECURITY = ["owner", "admin", "security"] as const;
const refresh = () => revalidatePath("/[locale]/business", "layout");

/** Org switcher: cookie-backed, always re-validated on the server (SPEC 9). */
export async function setActiveOrg(input: unknown) {
  const parsed = z.object({ orgId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  await requireUser();
  await requireOrgRole(parsed.data.orgId, ["owner", "admin", "security", "comms", "finance", "viewer", "contact"]);
  (await cookies()).set(ACTIVE_ORG_COOKIE, parsed.data.orgId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  refresh();
  return { ok: true as const, data: null };
}

/* B2 brand setup */
const assetKind = z.enum(["domain", "brand_name", "sms_sender", "phone", "social"]);
export async function addBrandAsset(input: unknown) {
  return orgAction(MANAGE, z.object({ kind: assetKind, value: z.string().trim().min(2).max(253) }), input, async ({ kind, value }, ctx) => {
    const v = kind === "domain" ? hostOf(value) : value;
    if (!v) throw new ActionError("invalid", "domain");
    check(await ctx.supabase.from("brand_assets").insert({ org_id: ctx.org.id, kind, value: v }), "asset");
    await audit({ actorId: ctx.user.id, action: "brand_asset.add", entity: "organization", entityId: ctx.org.id, data: { kind } });
    refresh();
    return null;
  });
}
export async function removeBrandAsset(input: unknown) {
  return orgAction(MANAGE, z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("brand_assets").delete().eq("id", id).eq("org_id", ctx.org.id));
    await audit({ actorId: ctx.user.id, action: "brand_asset.remove", entity: "organization", entityId: ctx.org.id });
    refresh();
    return null;
  });
}
export async function getVerificationToken(input: unknown) {
  return orgAction(MANAGE, z.object({ domain: z.string().max(253) }), input, async ({ domain }, ctx) => ({ token: verificationToken(ctx.org.id, domain) }));
}
export async function verifyBrandDomain(input: unknown) {
  return orgAction(MANAGE, z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const a = check(await ctx.supabase.from("brand_assets").select("kind, value").eq("id", id).eq("org_id", ctx.org.id).single());
    if (a.kind !== "domain") throw new ActionError("invalid");
    const ok = await verifyDomainOwnership(ctx.org.id, a.value);
    if (!ok) throw new ActionError("conflict", "verifyFail");
    check(await ctx.supabase.from("brand_assets").update({ verified_at: new Date().toISOString() }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: "brand_asset.verify", entity: "organization", entityId: ctx.org.id, data: { domain: a.value } });
    refresh();
    return null;
  });
}

/* B3 alerts */
export async function updateBrandAlert(input: unknown) {
  return orgAction(SECURITY, z.object({ id: z.uuid(), status: z.enum(["acknowledged", "resolved"]) }), input, async ({ id, status }, ctx) => {
    check(await ctx.supabase.from("brand_alerts").update({ status }).eq("id", id).eq("org_id", ctx.org.id));
    await audit({ actorId: ctx.user.id, action: `brand_alert.${status}`, entity: "brand_alert", entityId: id });
    refresh();
    return null;
  });
}
/** "Escalate to SOC" creates a report with source business and reporter_org_id (SPEC 9). */
export async function escalateBrandAlert(input: unknown) {
  return orgAction(SECURITY, z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const a = check(await ctx.supabase.from("brand_alerts").select("title, domains(domain)").eq("id", id).eq("org_id", ctx.org.id).single());
    const domain = (a.domains as { domain: string } | null)?.domain;
    const created = await createReport({ category: "other", channel: "web", url: domain, text: a.title, locale: "en", source: "business", reporterId: ctx.user.id, reporterOrgId: ctx.org.id });
    if (!created.ok) throw new Error("report");
    check(await ctx.supabase.from("brand_alerts").update({ status: "escalated" }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: "brand_alert.escalate", entity: "brand_alert", entityId: id, data: { report: created.data.protocol } });
    refresh();
    return { protocol: created.data.protocol };
  });
}

/* B5 domains */
export async function allowlistOwnDomain(input: unknown) {
  return orgAction(SECURITY, z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const db = tryAdmin();
    if (!db) throw new ActionError("conflict", "unavailable");
    // RLS shows the member only lookalikes of their own institution; re-check with that view first.
    const d = check(await ctx.supabase.from("domains").select("id, domain").eq("id", id).maybeSingle());
    if (!d) throw new ActionError("forbidden");
    await db.from("domains").update({ status: "allowlisted" }).eq("id", id);
    await db.from("brand_assets").upsert({ org_id: ctx.org.id, kind: "domain", value: d.domain }, { onConflict: "org_id,kind,value", ignoreDuplicates: true });
    await audit({ actorId: ctx.user.id, action: "domain.allowlist_by_org", entity: "domain", entityId: id, data: { org: ctx.org.id } });
    refresh();
    return null;
  });
}
export async function requestDomainTakedown(input: unknown) {
  return orgAction(SECURITY, z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const d = check(await ctx.supabase.from("domains").select("domain").eq("id", id).maybeSingle());
    if (!d) throw new ActionError("forbidden");
    const created = await createReport({ category: "other", channel: "web", url: d.domain, text: `Takedown request from ${ctx.org.name} for ${d.domain}`, locale: "en", source: "business", reporterId: ctx.user.id, reporterOrgId: ctx.org.id });
    if (!created.ok) throw new Error("report");
    await audit({ actorId: ctx.user.id, action: "domain.takedown_request", entity: "domain", entityId: id, data: { report: created.data.protocol } });
    refresh();
    return { protocol: created.data.protocol };
  });
}

/* B9 API keys: shown once, only the hash is stored */
export async function createApiKey(input: unknown) {
  return orgAction(MANAGE, z.object({ name: z.string().trim().min(2).max(60), scopes: z.array(z.enum(["scan", "iocs"])).min(1) }), input, async ({ name, scopes }, ctx) => {
    const key = `mbk_${randomToken()}`;
    const row = check(await ctx.supabase.from("api_keys").insert({ org_id: ctx.org.id, name, scopes, prefix: key.slice(0, 12), key_hash: sha256(key) }).select("id").single());
    await audit({ actorId: ctx.user.id, action: "api_key.create", entity: "api_key", entityId: row.id, data: { scopes } });
    refresh();
    return { key };
  });
}
export async function revokeApiKey(input: unknown) {
  return orgAction(MANAGE, z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("org_id", ctx.org.id));
    await audit({ actorId: ctx.user.id, action: "api_key.revoke", entity: "api_key", entityId: id });
    refresh();
    return null;
  });
}

/* B10 team */
const orgRole = z.enum(["owner", "admin", "security", "comms", "finance", "viewer", "contact"]);
export async function inviteMember(input: unknown) {
  return orgAction(MANAGE, z.object({ email: z.email(), role: orgRole }), input, async ({ email, role }, ctx) => {
    if (role === "owner" && ctx.orgRole !== "owner") throw new ActionError("forbidden");
    const db = tryAdmin();
    if (!db) throw new ActionError("conflict", "unavailable");
    const list = await db.auth.admin.listUsers({ perPage: 1000 });
    let userId = list.data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) {
      const inv = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/sq/auth/confirm` });
      if (inv.error || !inv.data.user) throw new ActionError("conflict", inv.error?.message);
      userId = inv.data.user.id;
    }
    await db.from("organization_members").upsert({ org_id: ctx.org.id, user_id: userId, role }, { onConflict: "org_id,user_id" });
    await audit({ actorId: ctx.user.id, action: "member.invite", entity: "organization", entityId: ctx.org.id, data: { role } });
    refresh();
    return null;
  });
}
async function ownerCount(ctx: Parameters<Parameters<typeof orgAction>[3]>[1]) {
  const { count } = await ctx.supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("org_id", ctx.org.id).eq("role", "owner");
  return count ?? 0;
}
export async function setMemberRole(input: unknown) {
  return orgAction(MANAGE, z.object({ userId: z.uuid(), role: orgRole }), input, async ({ userId, role }, ctx) => {
    const cur = check(await ctx.supabase.from("organization_members").select("role").eq("org_id", ctx.org.id).eq("user_id", userId).single());
    if ((role === "owner" || cur.role === "owner") && ctx.orgRole !== "owner") throw new ActionError("forbidden");
    if (cur.role === "owner" && role !== "owner" && (await ownerCount(ctx)) <= 1) throw new ActionError("conflict", "lastOwner");
    check(await ctx.supabase.from("organization_members").update({ role }).eq("org_id", ctx.org.id).eq("user_id", userId));
    await audit({ actorId: ctx.user.id, action: "member.role", entity: "organization", entityId: ctx.org.id, data: { user: userId, from: cur.role, to: role } });
    refresh();
    return null;
  });
}
export async function removeMember(input: unknown) {
  return orgAction(MANAGE, z.object({ userId: z.uuid() }), input, async ({ userId }, ctx) => {
    const cur = check(await ctx.supabase.from("organization_members").select("role").eq("org_id", ctx.org.id).eq("user_id", userId).single());
    if (cur.role === "owner" && (ctx.orgRole !== "owner" || (await ownerCount(ctx)) <= 1)) throw new ActionError("conflict", "lastOwner");
    check(await ctx.supabase.from("organization_members").delete().eq("org_id", ctx.org.id).eq("user_id", userId));
    await audit({ actorId: ctx.user.id, action: "member.remove", entity: "organization", entityId: ctx.org.id, data: { user: userId } });
    refresh();
    return null;
  });
}

/* B12 settings */
export async function saveOrgSettings(input: unknown) {
  return orgAction(MANAGE, z.object({ name: z.string().trim().min(2).max(120), notificationEmails: z.array(z.email()).max(20), retentionDays: z.number().int().min(30).max(1825) }), input, async (v, ctx) => {
    check(await ctx.supabase.from("organizations").update({ name: v.name, notification_emails: v.notificationEmails, retention_days: v.retentionDays }).eq("id", ctx.org.id));
    await audit({ actorId: ctx.user.id, action: "org.settings", entity: "organization", entityId: ctx.org.id });
    refresh();
    return null;
  });
}
