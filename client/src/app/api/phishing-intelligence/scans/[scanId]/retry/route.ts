import { after, NextResponse, type NextRequest } from "next/server";
import { idParamSchema } from "@/lib/schemas/phishing-intel";
import { apiError, preflight } from "@/server/api";
import { guard, loadOwnedScan } from "@/server/phishing-intel/http";
import { principalId } from "@/server/phishing-intel/principal";
import { processScan, requeue } from "@/server/phishing-intel/scan-service";
import { limit } from "@/server/rate-limit";

export const OPTIONS = preflight;

/** POST /api/phishing-intelligence/scans/:id/retry — re-run an eligible failed or partial scan. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const id = idParamSchema.safeParse((await params).scanId);
  if (!id.success) return apiError(404, "not_found", "Scan not found", g.cors);
  const s = await loadOwnedScan(g, id.data);
  if (!s) return apiError(404, "not_found", "Scan not found", g.cors);
  const rl = await limit(`pi-retry:${principalId(g.principal)}`, 20, 3600);
  if (!rl.allowed) return apiError(429, "rate_limited", "20 retries per hour", g.cors);

  const result = await requeue(g.db, s.id);
  if (result === "not_eligible") return apiError(409, "not_eligible", "Only failed or partial scans can be retried", g.cors);
  if (result === "exhausted") return apiError(409, "attempts_exhausted", "This scan reached the retry limit", g.cors);
  const db = g.db;
  after(() => processScan(db, s.id));
  return NextResponse.json({ scanId: s.id, status: "queued" }, { status: 202, headers: g.cors });
}
