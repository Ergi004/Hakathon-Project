import { NextResponse, type NextRequest } from "next/server";
import { trackSchema } from "@/lib/schemas/analysis";
import { apiError } from "@/server/api";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";
import { getPublicTimeline } from "@/server/tracking";

/** GET /api/v1/reports/{protocol} with header X-Tracking-Token. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ protocol: string }> }) {
  if (!(await limit(`track:${ipHash(req.headers)}`, 30, 600)).allowed) return apiError(429, "rate_limited", "Too many requests");
  const { protocol } = await params;
  const parsed = trackSchema.safeParse({ protocol: decodeURIComponent(protocol), token: req.headers.get("x-tracking-token") ?? "" });
  if (!parsed.success) return apiError(400, "invalid", "Protocol or token missing");
  const timeline = await getPublicTimeline(parsed.data.protocol, parsed.data.token);
  if (!timeline) return apiError(404, "not_found", "No report for this protocol and token");
  return NextResponse.json(timeline, { headers: { "Cache-Control": "no-store" } });
}
