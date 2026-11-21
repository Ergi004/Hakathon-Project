import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { getSessionUser, hasMinRole } from "@/server/auth";
import { tryAdmin } from "@/server/db";
import { ipHash, safeEqualHex, sha256 } from "@/server/hash";
import { startLiveScan } from "@/server/intel/orchestrator";
import { limit } from "@/server/rate-limit";

export const maxDuration = 300;

const body = z.object({
  url: z.string().trim().min(3).max(2048),
  reportId: z.uuid().optional(),
  trackingToken: z.string().max(100).optional(),
  checkId: z.uuid().optional(),
  /** Tier B: only with the user's explicit consent ("The link will be sent to security analysis services."). */
  deep: z.boolean().optional(),
});

/**
 * POST /api/v1/scan/live { url, reportId?, checkId?, deep? } → { scanId, token }.
 * The scan continues after the response; follow it on .../[scanId]/stream?token=.
 */
export async function POST(req: NextRequest) {
  const parsed = await readJson(req, body);
  if (!parsed.ok) return parsed.res;
  const v = parsed.data;
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable");

  const ip = ipHash(req.headers);
  if (!(await limit(`live:${ip}:${sha256(v.url.toLowerCase())}`, 1, 60)).allowed) return apiError(429, "rate_limited", "One live scan per URL per minute");

  const session = await getSessionUser();
  const staff = !!session && hasMinRole(session.profile.platform_role, "soc_analyst");
  if (v.reportId) {
    // Staff, or the reporter holding the private tracking token.
    if (!staff) {
      const { data: r } = await db.from("reports").select("tracking_token_hash").eq("id", v.reportId).maybeSingle();
      if (!r?.tracking_token_hash || !v.trackingToken || !safeEqualHex(r.tracking_token_hash, sha256(v.trackingToken))) return apiError(403, "forbidden", "Not allowed for this report");
    }
  } else if (v.checkId) {
    const { data: c } = await db.from("checks").select("id").eq("id", v.checkId).maybeSingle();
    if (!c) return apiError(404, "not_found", "Unknown check");
  }

  const res = await startLiveScan({ url: v.url, reportId: v.reportId, checkId: v.checkId, deep: v.deep === true, requestedBy: session?.user.id ?? null });
  if (!res.ok) return apiError(res.reason === "unavailable" || res.reason === "error" ? 503 : 422, `not_eligible_${res.reason}`, "This URL cannot be scanned live");
  await audit({ actorId: session?.user.id ?? null, action: "intel.scan", entity: "scan", entityId: res.scanId, data: { deep: v.deep === true }, ipHash: ip });
  return NextResponse.json({ scanId: res.scanId, token: res.token }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
