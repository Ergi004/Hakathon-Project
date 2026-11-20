import { NextResponse, type NextRequest } from "next/server";
import { idParamSchema } from "@/lib/schemas/phishing-intel";
import { apiError, preflight } from "@/server/api";
import { guard, loadOwnedScan } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/scans/:id — status, progress and processing stages. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const id = idParamSchema.safeParse((await params).scanId);
  if (!id.success) return apiError(404, "not_found", "Scan not found", g.cors);
  const s = await loadOwnedScan(g, id.data);
  if (!s) return apiError(404, "not_found", "Scan not found", g.cors);
  const { data: events } = await g.db.from("scan_events").select("stage, status, message, created_at").eq("scan_id", s.id).order("id").limit(100);
  return NextResponse.json(
    {
      scanId: s.id,
      channel: s.channel.toUpperCase(),
      source: s.source,
      status: s.status,
      progress: s.progress,
      stages: s.stages,
      attempts: s.attempts,
      verdict: s.verdict,
      riskScore: s.risk_score,
      severity: s.severity,
      confidence: s.confidence,
      phishingType: s.phishing_type,
      phishingFamily: s.phishing_family,
      malwareFamily: s.malware_family,
      attributionStatus: s.attribution_status,
      createdAt: s.created_at,
      completedAt: s.completed_at,
      events: events ?? [],
      reportAvailable: s.status === "completed" || s.status === "partial",
    },
    { headers: g.cors },
  );
}
