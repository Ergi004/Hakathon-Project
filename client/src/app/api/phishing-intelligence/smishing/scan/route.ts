import type { NextRequest } from "next/server";
import { smishingRequestSchema } from "@/lib/schemas/phishing-intel";
import { preflight, readJson } from "@/server/api";
import { guard, submitScan } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** POST /api/phishing-intelligence/smishing/scan: alias that forwards to the shared scan service with channel=SMS. */
export async function POST(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const body = await readJson(req, smishingRequestSchema);
  if (!body.ok) return body.res;
  return submitScan(req, g, { channel: "SMS", ...body.data });
}
