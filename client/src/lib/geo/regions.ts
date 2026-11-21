/**
 * Static Albania region list (built by scripts/build-geo.ts from OCHA COD-AB 2019).
 * Safe for client and server: codes, names, parent county, centroid, neighbours, hex cell.
 */
import data from "../../../data/geo/regions.json";

export interface RegionInfo {
  code: string;
  name_sq: string;
  name_en: string;
  level: "county" | "municipality";
  parent_code: string | null;
  centroid_lat: number;
  centroid_lng: number;
  neighbors: string[];
  population: number | null;
  population_year: number | null;
  hex_q?: number | null;
  hex_r?: number | null;
}

export const REGIONS = data.regions as RegionInfo[];
export const MUNICIPALITIES = REGIONS.filter((r) => r.level === "municipality");
export const COUNTIES = REGIONS.filter((r) => r.level === "county");
export const REGION_BY_CODE = new Map(REGIONS.map((r) => [r.code, r]));
export const NEIGHBORS = new Map(MUNICIPALITIES.map((r) => [r.code, r.neighbors]));
export const HAS_POPULATION = MUNICIPALITIES.every((m) => (m.population ?? 0) > 0);

export function regionName(code: string | null | undefined, locale: string): string {
  const r = code ? REGION_BY_CODE.get(code) : undefined;
  if (!r) return code ?? "";
  return locale === "en" ? r.name_en || r.name_sq : r.name_sq;
}

export function municipalitiesOf(countyCode: string): RegionInfo[] {
  return MUNICIPALITIES.filter((m) => m.parent_code === countyCode).sort((a, b) => a.name_sq.localeCompare(b.name_sq, "sq"));
}

export const isMunicipalityCode = (code: unknown): code is string => typeof code === "string" && REGION_BY_CODE.get(code)?.level === "municipality";
