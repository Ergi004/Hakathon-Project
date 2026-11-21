/**
 * Projected Albania geometry for the SVG maps, computed once per module load (server and client).
 * Data: public/geo/*.topo.json (OCHA COD-AB 2019) and hex-layout.json. No network requests.
 */
import { geoMercator, geoPath } from "d3-geo";
import { feature, merge, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countiesTopo from "../../../public/geo/albania-counties.topo.json";
import hexLayout from "../../../public/geo/hex-layout.json";
import muniTopo from "../../../public/geo/albania-municipalities.topo.json";
import { axialToPixel, hexCorners } from "@/lib/geo/hex";

type Props = { code: string; name: string; name_en: string; county?: string };
type Topo<K extends string> = Topology<Record<K, GeometryCollection<Props>>>;

const muni = muniTopo as unknown as Topo<"municipalities">;
const counties = countiesTopo as unknown as Topo<"counties">;

export const VIEW = { w: 400, h: 720 };

const muniFc = feature(muni, muni.objects.municipalities) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, Props>;
const countyFc = feature(counties, counties.objects.counties) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, Props>;
const projection = geoMercator().fitExtent([[8, 8], [VIEW.w - 8, VIEW.h - 8]], muniFc);
const path = geoPath(projection);

export interface Shape { code: string; d: string; cx: number; cy: number; area: number }

export const MUNI_SHAPES: Shape[] = muniFc.features.map((f) => {
  const [cx, cy] = path.centroid(f);
  return { code: f.properties.code, d: path(f) ?? "", cx, cy, area: path.area(f) };
});
export const SHAPE_BY_CODE = new Map(MUNI_SHAPES.map((s) => [s.code, s]));

export const COUNTY_SHAPES: Shape[] = countyFc.features.map((f) => {
  const [cx, cy] = path.centroid(f);
  return { code: f.properties.code, d: path(f) ?? "", cx, cy, area: path.area(f) };
});
/** Internal county borders (drawn as an outline layer above the municipalities). */
export const COUNTY_BORDERS = path(mesh(counties, counties.objects.counties, (a, b) => a !== b)) ?? "";
export const COUNTRY_OUTLINE = path(mesh(muni, muni.objects.municipalities, (a, b) => a === b)) ?? "";

/** Outline of the union of several municipalities (hot-zone layer). */
export function zoneOutline(codes: string[]): string {
  const set = new Set(codes);
  const geoms = muni.objects.municipalities.geometries.filter((g) => set.has((g.properties as Props).code));
  return geoms.length ? path(merge(muni, geoms as never)) ?? "" : "";
}

/** Raw GeoJSON features (lon/lat) for the GeoJSON export. */
export function municipalityFeatures() {
  return muniFc.features.map((f) => ({ type: "Feature" as const, geometry: f.geometry as unknown, properties: { code: f.properties.code } as Record<string, unknown> }));
}

// ---- Hex tile map: same viewBox, fitted to the grid's extent ----
const cells = (hexLayout as { cells: Record<string, { q: number; r: number }> }).cells;
const raw = Object.entries(cells).map(([code, a]) => ({ code, p: axialToPixel(a, 1) }));
const minX = Math.min(...raw.map((r) => r.p[0])), maxX = Math.max(...raw.map((r) => r.p[0]));
const minY = Math.min(...raw.map((r) => r.p[1])), maxY = Math.max(...raw.map((r) => r.p[1]));
const HEX_SIZE = Math.min((VIEW.w - 40) / (maxX - minX + 2), (VIEW.h - 40) / (maxY - minY + 2));
const offX = (VIEW.w - (maxX - minX) * HEX_SIZE) / 2 - minX * HEX_SIZE;
const offY = (VIEW.h - (maxY - minY) * HEX_SIZE) / 2 - minY * HEX_SIZE;

export const HEX_SHAPES: Shape[] = raw.map(({ code, p }) => {
  const cx = p[0] * HEX_SIZE + offX, cy = p[1] * HEX_SIZE + offY;
  return { code, d: `M${hexCorners(cx, cy, HEX_SIZE * 0.96).split(" ").join("L")}Z`, cx, cy, area: HEX_SIZE * HEX_SIZE * 2.6 };
});
export const HEX_RADIUS = HEX_SIZE;
