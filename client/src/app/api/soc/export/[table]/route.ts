import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { apiError } from "@/server/api";
import { audit } from "@/server/audit";
import { getSessionUser, hasMinRole } from "@/server/auth";

const CAP = 10_000;

/**
 * Server-side CSV export of the current filters, capped at 10,000 rows (SPEC 10).
 * Uses the staff member's own session, so RLS applies.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const session = await getSessionUser();
  if (!session || !hasMinRole(session.profile.platform_role, "soc_analyst")) return apiError(401, "unauthorized", "Staff only");
  const { table } = await params;
  const sp = req.nextUrl.searchParams;
  const db = session.supabase;
  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];

  if (table === "reports") {
    let q = db.from("reports").select("protocol, status, flag, score, channel, source, created_at, campaigns(code)").order("created_at", { ascending: false }).limit(CAP);
    for (const k of ["status", "flag", "channel", "source"] as const) {
      const v = sp.get(k);
      if (v) q = q.eq(k, v as never);
    }
    if (sp.get("assigned") === "none") q = q.is("assigned_to", null);
    if (sp.get("assigned") === "me") q = q.eq("assigned_to", session.user.id);
    const campaign = sp.get("campaign");
    if (campaign === "none") q = q.is("campaign_id", null);
    else if (campaign && /^[0-9a-f-]{36}$/i.test(campaign)) q = q.eq("campaign_id", campaign);
    const period = Number(sp.get("period"));
    if ([1, 7, 30, 90].includes(period)) q = q.gte("created_at", new Date(Date.now() - period * 86_400_000).toISOString());
    rows = ((await q).data ?? []).map((r) => ({ ...r, campaign: (r.campaigns as { code: string } | null)?.code ?? "", campaigns: undefined }));
    columns = ["protocol", "status", "flag", "score", "channel", "source", "campaign", "created_at"];
  } else if (table === "campaigns") {
    rows = (await db.from("campaigns").select("code, tactic, imitated_name, status, severity, message_count, first_seen, last_seen, is_public").limit(CAP)).data ?? [];
    columns = ["code", "tactic", "imitated_name", "status", "severity", "message_count", "first_seen", "last_seen", "is_public"];
  } else if (table === "domains") {
    let q = db.from("domains").select("domain, class, imitates_domain, registrar, hosting_country, age_days, risk_score, status").limit(CAP);
    if (sp.get("status")) q = q.eq("status", sp.get("status")!);
    if (sp.get("cls")) q = q.eq("class", sp.get("cls") as never);
    rows = ((await q).data ?? []).map((d) => ({ ...d, domain: d.domain.replace(/\./g, "[.]") }));
    columns = ["domain", "class", "imitates_domain", "registrar", "hosting_country", "age_days", "risk_score", "status"];
  } else if (table === "blocklist") {
    rows = ((await db.from("blocklist_entries").select("type, value, reason, expires_at, created_at").limit(CAP)).data ?? []).map((b) => ({ ...b, value: b.value.replace(/\./g, "[.]").replace(/^http/i, "hxxp") }));
    columns = ["type", "value", "reason", "expires_at", "created_at"];
  } else if (table === "takedowns") {
    rows = ((await db.from("takedown_notices").select("protocol, kind, status, sent_at, due_at, resolved_at, campaigns(code)").limit(CAP)).data ?? []).map((n) => ({ ...n, campaign: (n.campaigns as { code: string } | null)?.code ?? "", campaigns: undefined }));
    columns = ["protocol", "kind", "status", "campaign", "sent_at", "due_at", "resolved_at"];
  } else if (table === "audit") {
    if (!hasMinRole(session.profile.platform_role, "soc_lead")) return apiError(403, "forbidden", "Leads only");
    let q = db.from("audit_log").select("created_at, action, entity, entity_id, actor_id").order("created_at", { ascending: false }).limit(CAP);
    if (sp.get("action")) q = q.ilike("action", `${sp.get("action")}%`);
    rows = (await q).data ?? [];
    columns = ["created_at", "action", "entity", "entity_id", "actor_id"];
  } else {
    return apiError(404, "not_found", "Unknown table");
  }

  await audit({ actorId: session.user.id, action: "export.csv", entity: table, data: { rows: rows.length } });
  return new NextResponse(toCsv(rows, columns), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${table}-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
