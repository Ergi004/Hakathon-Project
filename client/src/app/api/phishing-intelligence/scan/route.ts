import type { NextRequest } from "next/server";
import { scanRequestSchema } from "@/lib/schemas/phishing-intel";
import { preflight, readJson } from "@/server/api";
import { guard, MAX_SCAN_BODY, submitScan } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** POST /api/phishing-intelligence/scan: channel EMAIL or SMS → 202 Accepted, processed asynchronously. */
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const body = await readJson(req, scanRequestSchema, MAX_SCAN_BODY);
  if (!body.ok) return body.res;
  return submitScan(req, g, body.data);
}
