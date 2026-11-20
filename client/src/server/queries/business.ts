import "server-only";

import type { OrgCtx } from "@/server/auth";

/** Institution ids linked to the active organization (RLS also limits every read). */
export async function orgInstitutionIds(ctx: OrgCtx): Promise<string[]> {
  const { data } = await ctx.supabase.from("institutions").select("id").eq("organization_id", ctx.org.id);
  return (data ?? []).map((i) => i.id);
}

export async function getOverview(ctx: OrgCtx) {
  const inst = await orgInstitutionIds(ctx);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [alerts, urgent, campaigns, takedowns, reports] = await Promise.all([
    ctx.supabase.from("brand_alerts").select("id", { count: "exact", head: true }).eq("org_id", ctx.org.id).in("status", ["new", "acknowledged"]),
    ctx.supabase.from("brand_alerts").select("id, title, severity, status, created_at").eq("org_id", ctx.org.id).in("status", ["new", "acknowledged"]).order("severity", { ascending: false }).order("created_at", { ascending: false }).limit(3),
    inst.length ? ctx.supabase.from("campaigns").select("id", { count: "exact", head: true }).in("institution_id", inst).in("status", ["monitoring", "confirmed", "takedown_in_progress"]) : Promise.resolve({ count: 0 }),
    inst.length ? ctx.supabase.from("takedown_notices").select("id, campaigns!inner(institution_id)", { count: "exact", head: true }).in("campaigns.institution_id", inst).in("status", ["in_review", "approved", "sent", "acknowledged"]) : Promise.resolve({ count: 0 }),
    inst.length ? ctx.supabase.from("reports").select("created_at, campaigns!inner(institution_id)").in("campaigns.institution_id", inst).gte("created_at", since).limit(5000) : Promise.resolve({ data: [] as { created_at: string }[] }),
  ]);
  const days: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    days.push({ day: d, count: (reports.data ?? []).filter((r) => r.created_at.startsWith(d)).length });
  }
  return { openAlerts: alerts.count ?? 0, urgent: urgent.data ?? [], activeCampaigns: campaigns.count ?? 0, takedowns: takedowns.count ?? 0, customerReports: reports.data?.length ?? 0, days, hasInstitution: inst.length > 0 };
}
