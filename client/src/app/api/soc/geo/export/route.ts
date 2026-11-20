import { NextResponse, type NextRequest } from "next/server";
import { municipalityFeatures } from "@/components/geo/geometry";
import { filtersToQuery, parseGeoFilters } from "@/lib/geo/filters";
import { audit } from "@/server/audit";
import { getSessionUser, hasMinRole } from "@/server/auth";
import { toCsv, toGeoJson } from "@/server/geo/export";
import { getGeoData } from "@/server/geo/stats";

/** GET /api/soc/geo/export?format=csv|geojson&<filters>: staff only, aggregates only, audited. */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || !hasMinRole(session.profile.platform_role, "soc_analyst")) return NextResponse.json({ error: { code: "forbidden", message: "Staff only" } }, { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const format = sp.format === "geojson" ? "geojson" : "csv";
  const filters = parseGeoFilters(sp);
  const locale = sp.locale === "en" ? "en" : "sq";
  const data = await getGeoData(session.supabase, filters, locale);
  const meta = { source: "Mburoja geographic threat map (aggregates only)", period: `${data.window.from} – ${data.window.to}`, mode: filters.mode, filters: filtersToQuery(filters) || "none", boundaries: "OCHA COD-AB Albania 2019 (CC BY-IGO)", generated: new Date().toISOString() };
  await audit({ actorId: session.user.id, action: `geo.export.${format}`, entity: "geo", data: { filters: meta.filters, rows: data.metrics.length } });
  const name = `mburoja-geo-${data.window.to}.${format === "csv" ? "csv" : "geojson"}`;
  const body = format === "csv" ? toCsv(data.metrics, meta) : JSON.stringify(toGeoJson(municipalityFeatures(), data.metrics, meta));
  return new NextResponse(body, { headers: { "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/geo+json", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
