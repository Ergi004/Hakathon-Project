import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/server/api";
import { tryAdmin } from "@/server/db";
import { getScanSnapshot, verifyScanToken } from "@/server/intel/snapshot";

/** Fallback poll: current normalised state of a scan (token required). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable");
  if (!z.uuid().safeParse(scanId).success || !(await verifyScanToken(db, scanId, token))) return apiError(404, "not_found", "Unknown scan");
  return NextResponse.json(await getScanSnapshot(db, scanId), { headers: { "Cache-Control": "no-store" } });
}
