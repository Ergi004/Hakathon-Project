import { NextResponse, type NextRequest } from "next/server";
import { getPublicStats, getThreatFeed } from "@/server/queries/public";

/** GET /api/v1/feed?institution&since (SPEC 12.3, 13.2): sanitized public feed, cached 60 s. */
export async function GET(req: NextRequest) {
  const institution = req.nextUrl.searchParams.get("institution")?.slice(0, 120) || undefined;
  const sinceRaw = req.nextUrl.searchParams.get("since");
  const since = sinceRaw && /^\d{4}-\d{2}-\d{2}$/.test(sinceRaw) ? sinceRaw : undefined;
  const [items, stats] = await Promise.all([getThreatFeed({ institution, since }), getPublicStats()]);
  return NextResponse.json(
    {
      data: items.map((c) => ({ ...c, domains: (c.domains ?? []).map((d) => d.replace(/\./g, "[.]")) })),
      aggregates: {
        byScamType: stats.byScamType,
        byBrand: stats.byBrand,
        byWeek: stats.byWeek,
        regions: stats.regions,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
