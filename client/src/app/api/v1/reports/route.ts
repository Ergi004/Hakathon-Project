import { NextResponse, type NextRequest } from "next/server";
import { reportSchema } from "@/lib/schemas/analysis";
import { apiError, readJson } from "@/server/api";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";
import { createReport } from "@/server/reports";

/** POST /api/v1/reports: anonymous web report with honeypot, 10 / hour / IP hash. */
export async function POST(req: NextRequest) {
  const ip = ipHash(req.headers);
  if (!(await limit(`report:${ip}`, 10, 3600)).allowed) return apiError(429, "rate_limited", "10 reports per hour");
  const body = await readJson(req, reportSchema);
  if (!body.ok) return body.res;
  const res = await createReport({ ...body.data, source: "citizen_report" }, { ipHash: ip });
  if (!res.ok) return apiError(res.error === "unavailable" ? 503 : 500, res.error, "Could not create the report");
  return NextResponse.json({ protocol: res.data.protocol, trackingToken: res.data.trackingToken }, { status: 201 });
}
