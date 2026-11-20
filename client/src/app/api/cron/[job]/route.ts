import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api";
import { tryAdmin } from "@/server/db";
import { safeEqualHex, sha256 } from "@/server/hash";
import { JOBS, type JobName } from "@/server/jobs";

/** GET /api/cron/{job} with Authorization: Bearer ${CRON_SECRET} (SPEC 13.2-13.3). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqualHex(sha256(auth), sha256(secret))) return apiError(401, "unauthorized", "Bad cron secret");
  const { job } = await params;
  if (!(job in JOBS)) return apiError(404, "not_found", "Unknown job");
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Supabase not configured");
  const started = Date.now();
  try {
    const result = await JOBS[job as JobName](db);
    return NextResponse.json({ job, ms: Date.now() - started, result });
  } catch (e) {
    console.error(`cron ${job} failed`, e instanceof Error ? e.message : e);
    return apiError(500, "job_failed", job);
  }
}
