"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { globalSearch } from "@/server/queries/soc";

const statusEnum = z.enum(["received", "under_review", "confirmed", "not_scam", "takedown_requested", "taken_down", "duplicate"]);

/** Set status with an event, audit and model feedback label (A2/A3). */
export async function setReportStatus(input: unknown) {
  return staffAction("soc_analyst", z.object({ ids: z.array(z.uuid()).min(1).max(200), status: statusEnum, note: z.string().max(2000).optional() }), input, async ({ ids, status, note }, ctx) => {
    const rows = check(await ctx.supabase.from("reports").select("id, status, flag, message_id").in("id", ids));
    if (!rows.length) throw new ActionError("notFound");
    check(await ctx.supabase.from("reports").update({ status, ...(note ? { resolution_note: note } : {}) }).in("id", ids));
    check(await ctx.supabase.from("report_events").insert(rows.map((r) => ({ report_id: r.id, actor_id: ctx.user.id, kind: "status_change", data: { from: r.status, to: status, note: note ?? null } }))));
    if (status === "confirmed" || status === "not_scam") {
      const actual = status === "confirmed" ? "phishing" : "legitimate";
      await ctx.supabase.from("feedback_labels").insert(rows.map((r) => ({ report_id: r.id, message_id: r.message_id, analyst_id: ctx.user.id, predicted: (r.flag && ["orange", "red", "darkred"].includes(r.flag) ? "phishing" : "legitimate") as "phishing" | "legitimate", actual: actual as "phishing" | "legitimate" })));
      const msgIds = rows.map((r) => r.message_id).filter((x): x is string => !!x);
      if (msgIds.length) await ctx.supabase.from("messages").update({ label: actual }).in("id", msgIds);
    }
    for (const r of rows) await audit({ actorId: ctx.user.id, action: "report.status", entity: "report", entityId: r.id, data: { from: r.status, to: status } });
    revalidatePath("/[locale]/soc", "layout");
    updateTag("kpis");
    return { count: rows.length };
  });
}

export async function assignReports(input: unknown) {
  return staffAction("soc_analyst", z.object({ ids: z.array(z.uuid()).min(1).max(200), assignee: z.uuid().nullable().or(z.literal("me")) }), input, async ({ ids, assignee }, ctx) => {
    const to = assignee === "me" ? ctx.user.id : assignee;
    check(await ctx.supabase.from("reports").update({ assigned_to: to }).in("id", ids));
    check(await ctx.supabase.from("report_events").insert(ids.map((id) => ({ report_id: id, actor_id: ctx.user.id, kind: "assigned", data: { to } }))));
    for (const id of ids) await audit({ actorId: ctx.user.id, action: "report.assign", entity: "report", entityId: id, data: { to } });
    revalidatePath("/[locale]/soc", "layout");
    return null;
  });
}

/** Link reports (and their messages and IoCs) to a campaign by id or code. */
export async function linkReportsToCampaign(input: unknown) {
  return staffAction("soc_analyst", z.object({ ids: z.array(z.uuid()).min(1).max(200), campaignId: z.uuid().optional(), code: z.string().trim().max(32).optional() }), input, async ({ ids, campaignId, code }, ctx) => {
    let q = ctx.supabase.from("campaigns").select("id, code, message_count");
    q = campaignId ? q.eq("id", campaignId) : q.eq("code", code ?? "");
    const camp = check(await q.maybeSingle());
    if (!camp) throw new ActionError("notFound", "campaign");
    const reps = check(await ctx.supabase.from("reports").select("id, message_id, messages(urls)").in("id", ids));
    check(await ctx.supabase.from("reports").update({ campaign_id: camp.id }).in("id", ids));
    const msgIds = reps.map((r) => r.message_id).filter((x): x is string => !!x);
    if (msgIds.length) await ctx.supabase.from("messages").update({ campaign_id: camp.id }).in("id", msgIds);
    const urls = reps.flatMap((r) => (r.messages as { urls: string[] } | null)?.urls ?? []);
    if (urls.length) await ctx.supabase.from("iocs").update({ campaign_id: camp.id }).in("value", urls).is("campaign_id", null);
    await ctx.supabase.from("campaigns").update({ message_count: (camp.message_count ?? 0) + msgIds.length, last_seen: new Date().toISOString().slice(0, 10) }).eq("id", camp.id);
    check(await ctx.supabase.from("report_events").insert(ids.map((id) => ({ report_id: id, actor_id: ctx.user.id, kind: "linked_campaign", data: { campaign: camp.code } }))));
    for (const id of ids) await audit({ actorId: ctx.user.id, action: "report.link_campaign", entity: "report", entityId: id, data: { campaign: camp.code } });
    revalidatePath("/[locale]/soc", "layout");
    return { code: camp.code };
  });
}

export async function addReportNote(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), body: z.string().trim().min(1).max(4000) }), input, async ({ id, body }, ctx) => {
    check(await ctx.supabase.from("report_events").insert({ report_id: id, actor_id: ctx.user.id, kind: "note", data: { body } }));
    await audit({ actorId: ctx.user.id, action: "report.note", entity: "report", entityId: id });
    revalidatePath("/[locale]/soc/inbox/[id]", "page");
    return null;
  });
}

export async function saveView(input: unknown) {
  return staffAction("soc_analyst", z.object({ name: z.string().trim().min(1).max(60), filters: z.record(z.string(), z.string()) }), input, async ({ name, filters }, ctx) => {
    check(await ctx.supabase.from("saved_views").upsert({ user_id: ctx.user.id, scope: "inbox", name, filters }, { onConflict: "user_id,scope,name" }));
    revalidatePath("/[locale]/soc/inbox", "page");
    return null;
  });
}

export async function deleteView(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("saved_views").delete().eq("id", id).eq("user_id", ctx.user.id));
    revalidatePath("/[locale]/soc/inbox", "page");
    return null;
  });
}

/** Staff "Reveal" on a defanged IoC is audited (SPEC 15.2). */
export async function auditReveal(input: unknown) {
  return staffAction("soc_analyst", z.object({ entity: z.string().max(40), value: z.string().max(2048) }), input, async ({ entity, value }, ctx) => {
    await audit({ actorId: ctx.user.id, action: "ioc.reveal", entity, data: { value } });
    return null;
  });
}

/** Command palette search (⌘K). */
export async function paletteSearch(input: unknown) {
  return staffAction("soc_analyst", z.object({ q: z.string().max(200) }), input, async ({ q }, ctx) => globalSearch(ctx.supabase, q));
}
