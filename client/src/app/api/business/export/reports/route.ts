import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { apiError } from "@/server/api";
import { audit } from "@/server/audit";
import { ForbiddenError, requireActiveOrg } from "@/server/auth";

/** B6 export: anonymised customer reports for the active organization (RLS applies). */
export async function GET() {
  let ctx;
  try {
    ctx = await requireActiveOrg(["owner", "admin", "security"]);
  } catch (e) {
    if (e instanceof ForbiddenError) return apiError(403, "forbidden", "Not allowed");
    throw e;
  }
  const { data: inst } = await ctx.supabase.from("institutions").select("id").eq("organization_id", ctx.org.id);
  const ids = (inst ?? []).map((i) => i.id);
  const { data } = ids.length
    ? await ctx.supabase.from("reports").select("protocol, status, flag, score, channel, created_at, campaigns!inner(code, institution_id), messages(body_masked)").in("campaigns.institution_id", ids).limit(10000)
    : { data: [] };
  const rows = (data ?? []).map((r) => ({ protocol: r.protocol, status: r.status, flag: r.flag, score: r.score, channel: r.channel, campaign: (r.campaigns as { code: string }).code, created_at: r.created_at, text_masked: (r.messages as { body_masked: string } | null)?.body_masked ?? "" }));
  await audit({ actorId: ctx.user.id, action: "org.reports_export", entity: "organization", entityId: ctx.org.id, data: { rows: rows.length } });
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="customer-reports.csv"`, "Cache-Control": "no-store" } });
}
