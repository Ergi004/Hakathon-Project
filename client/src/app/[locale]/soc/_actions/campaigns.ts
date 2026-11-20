"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { candidateCode } from "@/server/detection/campaigns";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { hasMinRole } from "@/server/auth";

const severity = z.enum(["low", "medium", "high", "critical"]);
const cstatus = z.enum(["monitoring", "confirmed", "takedown_in_progress", "resolved"]);

async function nextCode(db: Parameters<Parameters<typeof staffAction>[3]>[1]["supabase"]) {
  const year = new Date().getFullYear();
  const { data } = await db.from("campaigns").select("code").like("code", `C-${year}-%`).order("code", { ascending: false }).limit(1);
  const last = Number(data?.[0]?.code.split("-")[2] ?? 0);
  return candidateCode(year, last + 1);
}

export async function createCampaign(input: unknown) {
  return staffAction("soc_analyst", z.object({ tactic: z.string().trim().min(2).max(60), institutionId: z.uuid().nullable().optional(), imitated: z.string().trim().max(120).optional(), severity, summary: z.string().max(4000).optional() }), input, async (v, ctx) => {
    const code = await nextCode(ctx.supabase);
    const row = check(await ctx.supabase.from("campaigns").insert({ code, tactic: v.tactic, institution_id: v.institutionId ?? null, imitated_name: v.imitated || null, severity: v.severity, summary: v.summary || null, source: "manual", owner_id: ctx.user.id, first_seen: new Date().toISOString().slice(0, 10) }).select("id, code").single());
    await audit({ actorId: ctx.user.id, action: "campaign.create", entity: "campaign", entityId: row.id, data: { code } });
    revalidatePath("/[locale]/soc/campaigns", "page");
    return row;
  });
}

export async function updateCampaign(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), status: cstatus.optional(), severity: severity.optional(), ownerId: z.uuid().nullable().optional(), summary: z.string().max(4000).optional(), tactic: z.string().trim().min(2).max(60).optional(), imitated: z.string().trim().max(120).optional() }), input, async (v, ctx) => {
    const patch = {
      ...(v.status ? { status: v.status } : {}),
      ...(v.severity ? { severity: v.severity } : {}),
      ...(v.ownerId !== undefined ? { owner_id: v.ownerId } : {}),
      ...(v.summary !== undefined ? { summary: v.summary } : {}),
      ...(v.tactic ? { tactic: v.tactic } : {}),
      ...(v.imitated !== undefined ? { imitated_name: v.imitated || null } : {}),
    };
    check(await ctx.supabase.from("campaigns").update(patch).eq("id", v.id));
    await audit({ actorId: ctx.user.id, action: v.status ? "campaign.status" : "campaign.update", entity: "campaign", entityId: v.id, data: patch });
    revalidatePath("/[locale]/soc/campaigns", "layout");
    updateTag("feed");
    return null;
  });
}

/** Publishing to the public feed is lead-only (SPEC 4 matrix, 10 A5). */
export async function publishCampaign(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid(), publish: z.boolean() }), input, async ({ id, publish }, ctx) => {
    if (!hasMinRole(ctx.profile.platform_role, "soc_lead")) throw new ActionError("forbidden");
    const c = check(await ctx.supabase.from("campaigns").select("status").eq("id", id).single());
    if (publish && c.status === "monitoring") throw new ActionError("conflict", "confirm first");
    check(await ctx.supabase.from("campaigns").update({ is_public: publish }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: publish ? "campaign.publish" : "campaign.unpublish", entity: "campaign", entityId: id });
    revalidatePath("/[locale]/soc/campaigns", "layout");
    updateTag("feed");
    return null;
  });
}

export async function mergeCampaigns(input: unknown) {
  return staffAction("soc_analyst", z.object({ sourceId: z.uuid(), targetId: z.uuid() }).refine((v) => v.sourceId !== v.targetId), input, async ({ sourceId, targetId }, ctx) => {
    const db = ctx.supabase;
    const [src, tgt] = await Promise.all([db.from("campaigns").select("code, message_count, first_seen").eq("id", sourceId).single(), db.from("campaigns").select("code, message_count, first_seen").eq("id", targetId).single()]);
    if (!src.data || !tgt.data) throw new ActionError("notFound");
    for (const t of ["messages", "reports", "iocs", "certificates", "takedown_notices", "campaign_notes", "advisories", "known_hashes", "blocklist_entries", "brand_alerts", "checks"] as const) {
      await db.from(t).update({ campaign_id: targetId } as never).eq("campaign_id", sourceId);
    }
    const links = check(await db.from("campaign_domains").select("domain_id").eq("campaign_id", sourceId));
    if (links.length) await db.from("campaign_domains").upsert(links.map((l) => ({ campaign_id: targetId, domain_id: l.domain_id })), { onConflict: "campaign_id,domain_id", ignoreDuplicates: true });
    await db.from("campaigns").update({ message_count: (tgt.data.message_count ?? 0) + (src.data.message_count ?? 0) }).eq("id", targetId);
    check(await db.from("campaigns").delete().eq("id", sourceId));
    await audit({ actorId: ctx.user.id, action: "campaign.merge", entity: "campaign", entityId: targetId, data: { merged: src.data.code, into: tgt.data.code } });
    revalidatePath("/[locale]/soc/campaigns", "layout");
    return { code: tgt.data.code };
  });
}

export async function splitCampaign(input: unknown) {
  return staffAction("soc_analyst", z.object({ campaignId: z.uuid(), messageIds: z.array(z.uuid()).min(1).max(500) }), input, async ({ campaignId, messageIds }, ctx) => {
    const src = check(await ctx.supabase.from("campaigns").select("tactic, institution_id, imitated_name, severity, code, message_count").eq("id", campaignId).single());
    const code = await nextCode(ctx.supabase);
    const created = check(await ctx.supabase.from("campaigns").insert({ code, tactic: src.tactic, institution_id: src.institution_id, imitated_name: src.imitated_name, severity: src.severity, source: "manual", owner_id: ctx.user.id, message_count: messageIds.length, first_seen: new Date().toISOString().slice(0, 10) }).select("id").single());
    await ctx.supabase.from("messages").update({ campaign_id: created.id }).in("id", messageIds).eq("campaign_id", campaignId);
    await ctx.supabase.from("reports").update({ campaign_id: created.id }).in("message_id", messageIds);
    await ctx.supabase.from("campaigns").update({ message_count: Math.max(0, (src.message_count ?? 0) - messageIds.length) }).eq("id", campaignId);
    await audit({ actorId: ctx.user.id, action: "campaign.split", entity: "campaign", entityId: created.id, data: { from: src.code, count: messageIds.length } });
    revalidatePath("/[locale]/soc/campaigns", "layout");
    return { id: created.id, code };
  });
}

export async function addCampaignNote(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), body: z.string().trim().min(1).max(4000) }), input, async ({ id, body }, ctx) => {
    check(await ctx.supabase.from("campaign_notes").insert({ campaign_id: id, author_id: ctx.user.id, body }));
    await audit({ actorId: ctx.user.id, action: "campaign.note", entity: "campaign", entityId: id });
    revalidatePath("/[locale]/soc/campaigns/[id]", "page");
    return null;
  });
}
