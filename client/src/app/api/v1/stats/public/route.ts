import { NextResponse } from "next/server";
import { getPublicStats } from "@/server/queries/public";

/** GET /api/v1/stats/public: homepage counters. */
export async function GET() {
  return NextResponse.json(await getPublicStats(), { headers: { "Cache-Control": "public, s-maxage=60" } });
}
