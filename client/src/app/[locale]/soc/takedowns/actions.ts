"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { tryAdmin } from "@/server/db";
import { sendMail } from "@/server/email";
import { buildEvidencePdf } from "@/server/takedown/evidence";
import { buildNotice, noticeLocale, pickRecipient } from "@/server/takedown/fill";

const kind = z.enum(["registrar", "hosting", "akcesk"]);
const refresh = () => {
  revalidatePath("/[locale]/soc/takedowns", "layout");
  revalidatePath("/[locale]/soc/campaigns/[id]", "page");
  updateTag("kpis");
};

async function notifyLeads(title: string, href: string, exceptId?: string) {
  const db = tryAdmin();
  if (!db) return;
  const { data: leads } = await db.from("profiles").select("id").in("platform_role", ["soc_lead", "platform_admin"]);
  const rows = (leads ?? []).filter((l) => l.id !== exceptId).map((l) => ({ user_id: l.id, title, href }));
  if (rows.length) await db.from("notifications").insert(rows);
}

/** createTakedown: analyst, campaign confirmed → drafts + "created" events (SPEC 11.5). */
export async function createTakedown(input: unknown) {
  return staffAction("soc_analyst", z.object({ campaignId: z.uuid(), domainId: z.uuid().optional(), kinds: z.array(kind).min(1).max(3) }), input, async ({ campaignId, domainId, kinds }, ctx) => {
    const db = ctx.supabase;
    const c = check(await db.from("campaigns").select("id, code, status, imitated_name, first_seen").eq("id", campaignId).single());
    if (!["confirmed", "takedown_in_progress"].includes(c.status)) throw new ActionError("conflict", "notConfirmed");
    const domain = domainId
      ? check(await db.from("domains").select("id, domain, registrar, hosting_country").eq("id", domainId).single())
      : ((await db.from("campaign_domains").select("domains(id, domain, registrar, hosting_country)").eq("campaign_id", campaignId).limit(1)).data?.[0]?.domains as { id: string; domain: string; registrar: string | null; hosting_country: string | null } | null) ?? null;

    const ids: string[] = [];
    for (const k of kinds) {
      const recipient = await pickRecipient(db, k, domain);
      const locale = noticeLocale(k, domain?.domain ?? null);
      // Insert first to get the protocol number, then fill the template with it.
      const draft = check(await db.from("takedown_notices").insert({ campaign_id: c.id, domain_id: domain?.id ?? null, kind: k, recipient_id: recipient?.id ?? null, status: "draft", subject: "-", body: "-", created_by: ctx.user.id }).select("id, protocol").single());
      const filled = await buildNotice(db, k, locale, { protocol: draft.protocol, campaign: c, domain, analystName: ctx.profile.full_name ?? ctx.user.email ?? "SOC" });
      check(await db.from("takedown_notices").update(filled).eq("id", draft.id));
      check(await db.from("notice_events").insert({ notice_id: draft.id, actor_id: ctx.user.id, kind: "created", note: locale }));
      await audit({ actorId: ctx.user.id, action: "notice.create", entity: "takedown_notice", entityId: draft.id, data: { kind: k, campaign: c.code } });
      ids.push(draft.id);
    }
    refresh();
    return { ids };
  });
}

/** updateNoticeDraft: creator, status draft or in_review. */
export async function updateNoticeDraft(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), subject: z.string().trim().min(3).max(300), body: z.string().trim().min(20).max(20000) }), input, async ({ id, subject, body }, ctx) => {
    if (/\{\{|\}\}/.test(subject + body)) throw new ActionError("invalid", "placeholder");
    const n = check(await ctx.supabase.from("takedown_notices").select("created_by, status").eq("id", id).single());
    if (n.created_by !== ctx.user.id) throw new ActionError("forbidden");
    if (!["draft", "in_review"].includes(n.status)) throw new ActionError("conflict", "status");
    check(await ctx.supabase.from("takedown_notices").update({ subject, body }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: "notice.edit", entity: "takedown_notice", entityId: id });
    refresh();
    return null;
  });
}

/** submitForReview: creator → in_review, notifies leads. */
export async function submitForReview(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const n = check(await ctx.supabase.from("takedown_notices").select("created_by, status, protocol").eq("id", id).single());
    if (n.created_by !== ctx.user.id) throw new ActionError("forbidden");
    if (n.status !== "draft") throw new ActionError("conflict", "status");
    check(await ctx.supabase.from("takedown_notices").update({ status: "in_review" }).eq("id", id));
    check(await ctx.supabase.from("notice_events").insert({ notice_id: id, actor_id: ctx.user.id, kind: "submitted_for_review" }));
    await notifyLeads(`Takedown ${n.protocol} awaits approval`, `/soc/takedowns/${id}`, ctx.user.id);
    await audit({ actorId: ctx.user.id, action: "notice.submit", entity: "takedown_notice", entityId: id });
    refresh();
    return null;
  });
}

/**
 * approveAndSend: lead, not the creator (four-eyes: action check + DB constraint),
 * status in_review → evidence PDF, simulated send, sent with due_at.
 */
export async function approveAndSend(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const db = ctx.supabase;
    const n = check(await db.from("takedown_notices").select("id, protocol, created_by, status, subject, body, campaign_id, kind, recipients(abuse_email, sla_hours), campaigns(severity)").eq("id", id).single());
    if (n.created_by === ctx.user.id) throw new ActionError("conflict", "four-eyes");
    if (n.status !== "in_review") throw new ActionError("conflict", "status");
    const recipient = n.recipients as { abuse_email: string; sla_hours: number } | null;
    if (!recipient) throw new ActionError("invalid", "recipient");

    check(await db.from("takedown_notices").update({ status: "approved", approved_by: ctx.user.id }).eq("id", id));
    check(await db.from("notice_events").insert({ notice_id: id, actor_id: ctx.user.id, kind: "approved" }));

    const admin = tryAdmin();
    let evidencePath: string | null = null;
    if (admin) {
      const pdf = await buildEvidencePdf(admin, id, ctx.profile.full_name ?? ctx.user.email ?? "SOC lead");
      evidencePath = `${id}.pdf`;
      const up = await admin.storage.from("evidence").upload(evidencePath, pdf, { contentType: "application/pdf", upsert: true });
      if (up.error) evidencePath = null;
    }

    await sendMail({ to: recipient.abuse_email, subject: n.subject, body: n.body, kind: "takedown_notice", entity: "takedown_notice", entityId: id });
    const critical = (n.campaigns as { severity: string } | null)?.severity === "critical";
    const sla = n.kind === "hosting" && critical ? 12 : recipient.sla_hours;
    const sentAt = new Date();
    check(await db.from("takedown_notices").update({ status: "sent", sent_at: sentAt.toISOString(), due_at: new Date(sentAt.getTime() + sla * 3_600_000).toISOString(), evidence_path: evidencePath }).eq("id", id));
    check(await db.from("notice_events").insert({ notice_id: id, actor_id: ctx.user.id, kind: "sent", note: `${recipient.abuse_email} (simulated)` }));
    await db.from("campaigns").update({ status: "takedown_in_progress" }).eq("id", n.campaign_id).in("status", ["confirmed"]);
    await db.from("reports").update({ status: "takedown_requested" }).eq("campaign_id", n.campaign_id).eq("status", "confirmed");
    await audit({ actorId: ctx.user.id, action: "notice.approve_send", entity: "takedown_notice", entityId: id, data: { sla_hours: sla, evidence: !!evidencePath } });
    refresh();
    return null;
  });
}

/** logReply: analyst; may cascade domain → taken_down and campaign → resolved. */
export async function logReply(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), outcome: z.enum(["acknowledged", "taken_down", "rejected"]), note: z.string().trim().max(2000).optional() }), input, async ({ id, outcome, note }, ctx) => {
    const db = ctx.supabase;
    const n = check(await db.from("takedown_notices").select("status, domain_id, campaign_id").eq("id", id).single());
    if (!["sent", "acknowledged", "no_response"].includes(n.status)) throw new ActionError("conflict", "status");
    check(await db.from("takedown_notices").update({ status: outcome, ...(outcome === "taken_down" ? { resolved_at: new Date().toISOString() } : {}) }).eq("id", id));
    check(await db.from("notice_events").insert({ notice_id: id, actor_id: ctx.user.id, kind: outcome === "taken_down" ? "taken_down" : "reply", note: note ?? outcome }));

    if (outcome === "taken_down") {
      if (n.domain_id) {
        const others = check(await db.from("takedown_notices").select("status").eq("domain_id", n.domain_id));
        if (others.every((o) => o.status === "taken_down")) await db.from("domains").update({ status: "taken_down" }).eq("id", n.domain_id);
      }
      const doms = check(await db.from("campaign_domains").select("domains(status)").eq("campaign_id", n.campaign_id));
      if (doms.length && doms.every((d) => (d.domains as { status: string } | null)?.status === "taken_down")) {
        await db.from("campaigns").update({ status: "resolved" }).eq("id", n.campaign_id);
        await db.from("reports").update({ status: "taken_down" }).eq("campaign_id", n.campaign_id).in("status", ["confirmed", "takedown_requested"]);
      }
    }
    await audit({ actorId: ctx.user.id, action: `notice.${outcome}`, entity: "takedown_notice", entityId: id });
    refresh();
    updateTag("feed");
    return null;
  });
}

/** rejectNotice: lead → back to draft with a note. */
export async function rejectNotice(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid(), reason: z.string().trim().min(3).max(2000) }), input, async ({ id, reason }, ctx) => {
    const n = check(await ctx.supabase.from("takedown_notices").select("status, created_by, protocol").eq("id", id).single());
    if (n.status !== "in_review") throw new ActionError("conflict", "status");
    check(await ctx.supabase.from("takedown_notices").update({ status: "draft" }).eq("id", id));
    check(await ctx.supabase.from("notice_events").insert({ notice_id: id, actor_id: ctx.user.id, kind: "rejected", note: reason }));
    await tryAdmin()?.from("notifications").insert({ user_id: n.created_by, title: `Takedown ${n.protocol} returned to draft`, body: reason, href: `/soc/takedowns/${id}` });
    await audit({ actorId: ctx.user.id, action: "notice.reject", entity: "takedown_notice", entityId: id });
    refresh();
    return null;
  });
}

/** Signed URL to the evidence PDF, valid 5 minutes (SPEC 11.4). */
export async function evidenceUrl(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    const n = check(await ctx.supabase.from("takedown_notices").select("evidence_path").eq("id", id).single());
    if (!n.evidence_path) throw new ActionError("notFound");
    const admin = tryAdmin();
    const signed = await admin?.storage.from("evidence").createSignedUrl(n.evidence_path, 300);
    if (!signed?.data) throw new ActionError("notFound");
    await audit({ actorId: ctx.user.id, action: "evidence.download", entity: "takedown_notice", entityId: id });
    return { url: signed.data.signedUrl };
  });
}

/** Recipient picker in the editor (A8): creator, while draft or in review. */
export async function setNoticeRecipient(input: unknown) {
  return staffAction("soc_analyst", z.object({ id: z.uuid(), recipientId: z.uuid() }), input, async ({ id, recipientId }, ctx) => {
    const n = check(await ctx.supabase.from("takedown_notices").select("created_by, status").eq("id", id).single());
    if (n.created_by !== ctx.user.id || !["draft", "in_review"].includes(n.status)) throw new ActionError("forbidden");
    check(await ctx.supabase.from("takedown_notices").update({ recipient_id: recipientId }).eq("id", id));
    await audit({ actorId: ctx.user.id, action: "notice.recipient", entity: "takedown_notice", entityId: id });
    refresh();
    return null;
  });
}
