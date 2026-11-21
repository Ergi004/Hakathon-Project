import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/server/api";
import { tryAdmin } from "@/server/db";
import { getScanSnapshot, verifyScanToken } from "@/server/intel/snapshot";
import { streamScan } from "@/server/intel/stream";

export const maxDuration = 300;

/**
 * Server-Sent Events: one "result" event per finished provider row (in order),
 * "subdomains" when the subdomain list changes, "score" when the score changes,
 * and "done" at the end. This is how anonymous citizens see live updates.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable");
  if (!z.uuid().safeParse(scanId).success || !(await verifyScanToken(db, scanId, token))) return apiError(404, "not_found", "Unknown scan");
  const stream = streamScan(() => getScanSnapshot(db, scanId), { signal: req.signal });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
