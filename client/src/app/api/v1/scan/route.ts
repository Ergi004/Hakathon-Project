import { NextResponse, type NextRequest } from "next/server";
import { analysisInputSchema } from "@/lib/schemas/analysis";
import { apiError, authenticate, corsHeaders, preflight, principalKey, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { runCheck } from "@/server/checks";
import { limit } from "@/server/rate-limit";

export const OPTIONS = preflight;

/** POST /api/v1/scan (SPEC 12.3): install token or API key, 60 / hour. Stores a hash only. */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const who = await authenticate(req);
  if (!who) return apiError(401, "unauthorized", "Send an API key or install token as a Bearer token", cors);
  if (who.kind === "key" && !who.scopes.includes("scan")) return apiError(403, "forbidden", "Key lacks the scan scope", cors);

  const rl = await limit(`scan:${principalKey(who)}`, 60, 3600);
  if (!rl.allowed) return apiError(429, "rate_limited", "60 scans per hour", { ...cors, "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) });

  const body = await readJson(req, analysisInputSchema);
  if (!body.ok) return body.res;

  try {
    // ?liveScans=1..3 checks up to 3 distinct link domains; ?deep=1 adds tier B (VirusTotal URL analysis
    // + Hybrid Analysis), which the caller must only request with the user's consent.
    const liveScans = Math.min(3, Math.max(1, Number(req.nextUrl.searchParams.get("liveScans") ?? 1) || 1));
    const deep = req.nextUrl.searchParams.get("deep") === "1";
    const { result, checkId, scan, scans, explanation } = await runCheck(body.data, { linkUserId: null, liveScans, deep });
    await audit({ actorId: null, action: "api.scan", entity: "check", entityId: checkId, data: { via: who.kind, flag: result.flag } });
    return NextResponse.json({ ...result, checkId, scan, scans, explanation: explanation.text }, { headers: { ...cors, "X-RateLimit-Remaining": String(rl.remaining) } });
  } catch {
    return apiError(500, "internal", "Analysis failed", cors);
  }
}
