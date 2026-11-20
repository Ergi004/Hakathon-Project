import { NextResponse, type NextRequest } from "next/server";
import { iocQuerySchema } from "@/lib/schemas/phishing-intel";
import { apiError, preflight } from "@/server/api";
import { guard } from "@/server/phishing-intel/http";
import { listFilter } from "@/server/phishing-intel/principal";

export const OPTIONS = preflight;

const TYPE: Record<string, string> = { PHONE: "phone_number", URL: "url", DOMAIN: "domain", IP: "ip", FILE_HASH: "file_hash", EMAIL: "email" };

/**
 * GET /api/phishing-intelligence/iocs?type=&q= — indicators from scans the caller may see.
 * Phone numbers are personal data, so they never leave the caller's own scope.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const q = iocQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return apiError(422, "validation_failed", q.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), g.cors);

  let scans = g.db.from("phishing_scans").select("id").order("created_at", { ascending: false }).limit(500);
  const filter = await listFilter(g.db, g.principal);
  if (filter) scans = scans.or(filter);
  const { data: owned } = await scans;
  const ids = (owned ?? []).map((s) => s.id);
  if (!ids.length) return NextResponse.json({ items: [] }, { headers: g.cors });

  let query = g.db.from("scan_iocs").select("scan_id, type, value, location, created_at").in("scan_id", ids).order("created_at", { ascending: false }).limit(q.data.limit);
  if (q.data.type) query = query.eq("type", TYPE[q.data.type] ?? q.data.type);
  if (q.data.q) query = query.ilike("normalized_value", `%${q.data.q.replace(/[%_\\]/g, "\\$&").toLowerCase()}%`);
  const { data, error } = await query;
  if (error) return apiError(500, "internal", "Could not search indicators", g.cors);
  return NextResponse.json({ items: data ?? [] }, { headers: g.cors });
}
