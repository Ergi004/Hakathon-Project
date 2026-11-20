import { NextResponse, type NextRequest } from "next/server";
import { idParamSchema } from "@/lib/schemas/phishing-intel";
import { apiError, preflight } from "@/server/api";
import { guard } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/intelligence/actors/:id — actor details; evidence rows only for SOC staff. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return apiError(404, "not_found", "Actor not found", g.cors);
  const { data: actor } = await g.db.from("threat_actors").select("id, name, aliases, description, refs, created_at, updated_at").eq("id", id.data).maybeSingle();
  if (!actor) return apiError(404, "not_found", "Actor not found", g.cors);

  const staff = g.principal.kind === "user" && g.principal.staff;
  const { count } = await g.db.from("actor_evidence").select("id", { count: "exact", head: true }).eq("actor_id", actor.id);
  if (!staff) return NextResponse.json({ ...actor, evidenceCount: count ?? 0 }, { headers: g.cors });

  const { data: evidence } = await g.db
    .from("actor_evidence")
    .select("kind, source, source_url, verified, observed_at, ioc_type, ioc_value, campaigns(code)")
    .eq("actor_id", actor.id)
    .order("observed_at", { ascending: false })
    .limit(200);
  return NextResponse.json({ ...actor, evidenceCount: count ?? 0, evidence: evidence ?? [] }, { headers: g.cors });
}
