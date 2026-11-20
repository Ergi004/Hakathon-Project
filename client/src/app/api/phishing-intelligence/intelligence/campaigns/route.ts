import { NextResponse, type NextRequest } from "next/server";
import { apiError, preflight } from "@/server/api";
import { guard } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/intelligence/campaigns — SOC staff see all; everyone else only public campaigns. */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const staff = g.principal.kind === "user" && g.principal.staff;
  let q = g.db
    .from("campaigns")
    .select("id, code, status, tactic, imitated_name, first_seen, last_seen, message_count, is_public")
    .order("last_seen", { ascending: false })
    .limit(200);
  if (!staff) q = q.eq("is_public", true).in("status", ["confirmed", "takedown_in_progress", "resolved"]);
  const { data, error } = await q;
  if (error) return apiError(500, "internal", "Could not list campaigns", g.cors);
  return NextResponse.json({ items: data ?? [] }, { headers: g.cors });
}
