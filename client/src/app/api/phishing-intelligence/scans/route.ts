import { NextResponse, type NextRequest } from "next/server";
import { scanListQuerySchema } from "@/lib/schemas/phishing-intel";
import { apiError, preflight } from "@/server/api";
import { guard } from "@/server/phishing-intel/http";
import { listFilter } from "@/server/phishing-intel/principal";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/scans?channel=SMS&status=&limit=&before= — scans visible to the caller. */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const q = scanListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return apiError(422, "validation_failed", q.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), g.cors);

  let query = g.db
    .from("phishing_scans")
    .select("id, channel, source, status, verdict, risk_score, severity, confidence, phishing_type, phishing_family, malware_family, attribution_status, progress, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(q.data.limit);
  const filter = await listFilter(g.db, g.principal);
  if (filter) query = query.or(filter);
  if (q.data.channel) query = query.eq("channel", q.data.channel.toLowerCase());
  if (q.data.status) query = query.eq("status", q.data.status);
  if (q.data.before) query = query.lt("created_at", q.data.before);

  const { data, error } = await query;
  if (error) return apiError(500, "internal", "Could not list scans", g.cors);
  const items = (data ?? []).map((s) => ({ ...s, channel: s.channel.toUpperCase() }));
  return NextResponse.json({ items, nextBefore: items.length === q.data.limit ? items.at(-1)?.created_at : null }, { headers: g.cors });
}
