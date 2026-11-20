"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, check, userAction } from "@/server/action";
import { audit } from "@/server/audit";
import { recomputeSafetyScore } from "@/server/badges";
import { tryAdmin } from "@/server/db";
import { watchHash, watchLabel } from "@/server/watchlist";

const refresh = () => revalidatePath("/[locale]/citizen", "layout");
const consent = async (userId: string, kind: string, granted: boolean) => tryAdmin()?.from("consent_log").insert({ user_id: userId, kind, granted });

/* C2 */
export async function setSaveHistory(input: unknown) {
  return userAction(z.object({ on: z.boolean() }), input, async ({ on }, ctx) => {
    check(await ctx.supabase.from("profiles").update({ save_history: on }).eq("id", ctx.user.id));
    await consent(ctx.user.id, "save_history", on);
    refresh();
    return null;
  });
}
export async function deleteCheckLinks(input: unknown) {
  return userAction(z.object({ ids: z.array(z.uuid()).max(1000).optional(), all: z.boolean().optional() }), input, async ({ ids, all }, ctx) => {
    let q = ctx.supabase.from("user_check_links").delete().eq("user_id", ctx.user.id);
    if (!all) q = q.in("check_id", ids ?? []);
    check(await q);
    const db = tryAdmin();
    if (db) await recomputeSafetyScore(db, ctx.user.id);
    refresh();
    return null;
  });
}

/* C3: add detail to an own report (ownership checked through RLS first) */
export async function addReportDetail(input: unknown) {
  return userAction(z.object({ id: z.uuid(), body: z.string().trim().min(3).max(2000) }), input, async ({ id, body }, ctx) => {
    const own = check(await ctx.supabase.from("reports").select("id").eq("id", id).eq("reporter_id", ctx.user.id).maybeSingle());
    if (!own) throw new ActionError("forbidden");
    const { maskText } = await import("@/server/detection/masks");
    await tryAdmin()?.from("report_events").insert({ report_id: id, actor_id: ctx.user.id, kind: "note", data: { body: maskText(body), from: "reporter" } });
    revalidatePath("/[locale]/citizen/reports", "layout");
    return null;
  });
}

/* C4 */
export async function markNotificationsRead(input: unknown) {
  return userAction(z.object({ ids: z.array(z.uuid()).max(500).optional() }), input, async ({ ids }, ctx) => {
    let q = ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", ctx.user.id).is("read_at", null);
    if (ids?.length) q = q.in("id", ids);
    check(await q);
    refresh();
    return null;
  });
}
export async function setFollow(input: unknown) {
  return userAction(z.object({ institutionId: z.uuid(), follow: z.boolean() }), input, async ({ institutionId, follow }, ctx) => {
    if (follow) check(await ctx.supabase.from("user_follows").upsert({ user_id: ctx.user.id, institution_id: institutionId }));
    else check(await ctx.supabase.from("user_follows").delete().eq("user_id", ctx.user.id).eq("institution_id", institutionId));
    refresh();
    return null;
  });
}

/* C5 */
export async function addWatchItem(input: unknown) {
  return userAction(z.object({ kind: z.enum(["phone", "email", "name"]), value: z.string().trim().min(3).max(120) }), input, async ({ kind, value }, ctx) => {
    if (kind === "email" && !z.email().safeParse(value).success) throw new ActionError("invalid");
    check(await ctx.supabase.from("user_watch_items").insert({ user_id: ctx.user.id, kind, value_hash: watchHash(kind, value), label: watchLabel(kind, value) }), "watch");
    refresh();
    return null;
  });
}
export async function removeWatchItem(input: unknown) {
  return userAction(z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("user_watch_items").delete().eq("id", id).eq("user_id", ctx.user.id));
    refresh();
    return null;
  });
}

/* C8 */
export async function setExtensionAutoSubmit(input: unknown) {
  return userAction(z.object({ id: z.uuid(), on: z.boolean() }), input, async ({ id, on }, ctx) => {
    check(await ctx.supabase.from("extension_installs").update({ auto_submit: on, ...(on ? { consent_at: new Date().toISOString() } : {}) }).eq("id", id).eq("user_id", ctx.user.id));
    await consent(ctx.user.id, "extension_auto_submit", on);
    const db = tryAdmin();
    if (db) await recomputeSafetyScore(db, ctx.user.id);
    refresh();
    return null;
  });
}
export async function revokeExtension(input: unknown) {
  return userAction(z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const own = check(await ctx.supabase.from("extension_installs").select("id").eq("id", id).eq("user_id", ctx.user.id).maybeSingle());
    if (!own) throw new ActionError("forbidden");
    // Invalidate the install token and unlink from the account.
    await tryAdmin()?.from("extension_installs").update({ token_hash: null, user_id: null, auto_submit: false }).eq("id", id);
    await audit({ actorId: ctx.user.id, action: "extension.revoke", entity: "extension_install", entityId: id });
    refresh();
    return null;
  });
}

/* C9 */
export async function exportMyData() {
  return userAction(z.object({}), {}, async (_v, ctx) => {
    const db = ctx.supabase;
    const [profile, checks, reports, watch, progress, badges, consents, follows, notifications] = await Promise.all([
      db.from("profiles").select("full_name, locale, safety_score, save_history, notify_email, notify_in_app, created_at").eq("id", ctx.user.id).single(),
      db.from("user_check_links").select("kind, created_at, checks(score, flag, created_at)").eq("user_id", ctx.user.id),
      db.from("reports").select("protocol, status, flag, score, channel, created_at, messages(body_masked)").eq("reporter_id", ctx.user.id),
      db.from("user_watch_items").select("kind, label, created_at, last_match_at").eq("user_id", ctx.user.id),
      db.from("user_progress").select("guide_slug, quiz_score, completed_at").eq("user_id", ctx.user.id),
      db.from("user_badges").select("badge, awarded_at").eq("user_id", ctx.user.id),
      db.from("consent_log").select("kind, granted, created_at").eq("user_id", ctx.user.id),
      db.from("user_follows").select("institutions(name)").eq("user_id", ctx.user.id),
      db.from("notifications").select("title, created_at, read_at").eq("user_id", ctx.user.id),
    ]);
    await audit({ actorId: ctx.user.id, action: "privacy.export", entity: "profile", entityId: ctx.user.id });
    return {
      exported_at: new Date().toISOString(),
      email: ctx.user.email,
      profile: profile.data,
      checks: checks.data,
      reports: reports.data,
      watchlist: watch.data,
      learning: progress.data,
      badges: badges.data,
      consents: consents.data,
      follows: follows.data,
      notifications: notifications.data,
    };
  });
}

/** Deletes the auth user; profile and links cascade, reports keep reporter_id = null (SPEC 15.2). */
export async function deleteMyAccount(input: unknown) {
  return userAction(z.object({ confirm: z.enum(["FSHI", "DELETE"]) }), input, async (_v, ctx) => {
    const db = tryAdmin();
    if (!db) throw new ActionError("conflict", "unavailable");
    const { count } = await db.from("organization_members").select("org_id", { count: "exact", head: true }).eq("user_id", ctx.user.id).eq("role", "owner");
    if (count) throw new ActionError("conflict", "owner");
    await audit({ actorId: null, action: "account.delete", entity: "profile", entityId: ctx.user.id });
    const res = await db.auth.admin.deleteUser(ctx.user.id);
    if (res.error) throw new Error(res.error.message);
    await ctx.supabase.auth.signOut();
    return null;
  });
}

/* C10 */
export async function saveCitizenSettings(input: unknown) {
  return userAction(z.object({ fullName: z.string().trim().max(120), locale: z.enum(["sq", "en"]), notifyEmail: z.boolean(), notifyInApp: z.boolean() }), input, async (v, ctx) => {
    check(await ctx.supabase.from("profiles").update({ full_name: v.fullName || null, locale: v.locale, notify_email: v.notifyEmail, notify_in_app: v.notifyInApp }).eq("id", ctx.user.id));
    await consent(ctx.user.id, "notify_email", v.notifyEmail);
    const db = tryAdmin();
    if (db) await recomputeSafetyScore(db, ctx.user.id);
    refresh();
    return null;
  });
}
