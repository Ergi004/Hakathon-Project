import { NextResponse, type NextRequest } from "next/server";
import { apiError, preflight } from "@/server/api";
import { guard } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/intelligence/actors — known actor reference records. */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { data, error } = await g.db.from("threat_actors").select("id, name, aliases, description, updated_at").order("name").limit(500);
  if (error) return apiError(500, "internal", "Could not list actors", g.cors);
  return NextResponse.json({ items: data ?? [] }, { headers: g.cors });
}
