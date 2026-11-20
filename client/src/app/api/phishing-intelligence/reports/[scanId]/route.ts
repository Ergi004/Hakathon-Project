import { NextResponse, type NextRequest } from "next/server";
import { idParamSchema } from "@/lib/schemas/phishing-intel";
import { apiError, preflight } from "@/server/api";
import { guard, loadOwnedScan } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/reports/:id — the normalised investigation report. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const id = idParamSchema.safeParse((await params).scanId);
  if (!id.success) return apiError(404, "not_found", "Report not found", g.cors);
  const s = await loadOwnedScan(g, id.data);
  if (!s) return apiError(404, "not_found", "Report not found", g.cors);
  const { data } = await g.db.from("scan_reports").select("report").eq("scan_id", s.id).maybeSingle();
  if (!data) return apiError(409, "not_ready", `Scan is ${s.status}; the report is not available yet`, { ...g.cors, "Retry-After": "5" });
  return NextResponse.json(data.report, { headers: g.cors });
}
