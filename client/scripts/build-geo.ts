/**
 * Builds the Albania geometry used by /soc/geo from open official boundary data.
 *
 * Source: OCHA Common Operational Dataset, Albania Subnational Administrative Boundaries
 * (COD-AB, 2019 revision c), https://data.humdata.org/dataset/cod-ab-alb, licence CC BY-IGO.
 * ADM1 = 12 counties (qarqe), ADM2 = 61 municipalities (bashki). The script STOPS if the
 * counts differ: geometry is never invented.
 *
 * Outputs:
 *   public/geo/albania-municipalities.topo.json   simplified TopoJSON (object "municipalities")
 *   public/geo/albania-counties.topo.json         counties dissolved from municipalities (borders align)
 *   data/geo/regions.json                         codes, names, parent, centroid, neighbours, population
 *
 *   npm run geo:build
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { geoCentroid } from "d3-geo";
import mapshaper from "mapshaper";
import { feature, neighbors } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data/geo/raw");
const SRC_URL = "https://data.humdata.org/dataset/c62ad81d-ce24-4e61-90c6-836caeec6766/resource/8b4c10c8-9351-44e0-91af-6181e3b335e4/download/alb_adm_2019b_shp.zip";
const EXPECT = { counties: 12, municipalities: 61 };
const MAX_BYTES = 400 * 1024;

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\nNothing was written. Geometry is never invented: fix the source and run again.`);
  process.exit(1);
}

function download() {
  mkdirSync(RAW, { recursive: true });
  const zip = path.join(RAW, "alb_adm_2019b_shp.zip");
  if (!existsSync(zip)) {
    console.log("Downloading OCHA COD-AB Albania boundaries…");
    execFileSync("curl", ["-sSfL", SRC_URL, "-o", zip], { stdio: "inherit" });
  }
  execFileSync("unzip", ["-o", "-q", zip, "-d", RAW]);
  const find = (lvl: number) => readdirSync(RAW).find((f) => new RegExp(`adm${lvl}_\\d{4}[a-z]?\\.shp$`, "i").test(f)) ?? fail(`ADM${lvl} shapefile not found in ${RAW}`);
  return { adm1: path.join(RAW, find(1)), adm2: path.join(RAW, find(2)) };
}

/**
 * Display-name corrections for the source's ADM2_SQ field (geometry and codes untouched):
 * genitive forms → nominative, one typo, and AL1101 which the source labels "Kavajë" although its
 * English name and code order identify it as Kamëz. Listed in public/geo/ATTRIBUTION.md.
 */
export const NAME_FIX: Record<string, string> = {
  AL0104: "Skrapar", AL0503: "Lushnjë", AL0504: "Mallakastër", AL0701: "Devoll", AL0702: "Kolonjë",
  AL0803: "Tropojë", AL0901: "Kurbin", AL0903: "Mirditë", AL1101: "Kamëz",
};
const EN_FIX: Record<string, string> = { AL0803: "Tropoje", AL1105: "Tirana" };

const cleanName = (s: string) => s.replace(/^Bashkia\s+/i, "").replace(/\s+Municipal+y$/i, "").trim();

async function run(cmd: string): Promise<Record<string, Buffer | string>> {
  return mapshaper.applyCommands(cmd);
}

async function main() {
  const src = download();

  // Verify feature counts on the raw data before doing anything else.
  const count = async (file: string) => {
    const out = await run(`-i "${file}" -o format=geojson out.json`);
    return JSON.parse(String(out["out.json"])).features.length as number;
  };
  const [c1, c2] = [await count(src.adm1), await count(src.adm2)];
  console.log(`ADM1 features: ${c1} (expected ${EXPECT.counties}) · ADM2 features: ${c2} (expected ${EXPECT.municipalities})`);
  if (c1 !== EXPECT.counties) fail(`ADM1 has ${c1} features, not ${EXPECT.counties} counties.`);
  if (c2 !== EXPECT.municipalities) fail(`ADM2 has ${c2} features, not ${EXPECT.municipalities} municipalities.`);

  // Municipalities: simplify (topology preserved), keep only code/name/county.
  let pct = 15;
  let muniTopo = "";
  for (;;) {
    const out = await run(
      `-i "${src.adm2}" snap name=municipalities -proj wgs84 -clean ` +
        `-each "code=ADM2_PCODE, name=ADM2_SQ, name_en=ADM2_EN, county=ADM1_PCODE, county_name=ADM1_SQ, county_name_en=ADM1_EN" ` +
        `-filter-fields code,name,name_en,county,county_name,county_name_en ` +
        `-simplify ${pct}% keep-shapes planar -o format=topojson quantization=100000 out.json`,
    );
    muniTopo = String(out["out.json"]);
    if (Buffer.byteLength(muniTopo) <= MAX_BYTES || pct <= 1) break;
    pct = Math.max(1, pct - 1);
  }
  // Counties: dissolved from the simplified municipalities so the outlines match exactly.
  const countyOut = await run(
    `-i "${src.adm2}" snap name=counties -proj wgs84 -clean -simplify ${pct}% keep-shapes planar ` +
      `-dissolve ADM1_PCODE copy-fields=ADM1_SQ,ADM1_EN -each "code=ADM1_PCODE, name=ADM1_SQ, name_en=ADM1_EN" -filter-fields code,name,name_en ` +
      `-o format=topojson quantization=100000 out.json`,
  );
  const countyTopo = String(countyOut["out.json"]);

  const muni = JSON.parse(muniTopo) as Topology<{ municipalities: GeometryCollection<Record<string, string>> }>;
  const counties = JSON.parse(countyTopo) as Topology<{ counties: GeometryCollection<Record<string, string>> }>;
  type Props = Record<string, string>;
  const mGeoms = muni.objects.municipalities.geometries as unknown as { properties: Props }[];
  const cGeoms = counties.objects.counties.geometries as unknown as { properties: Props }[];
  if (mGeoms.length !== EXPECT.municipalities || cGeoms.length !== EXPECT.counties) fail(`After simplification: ${mGeoms.length} municipalities / ${cGeoms.length} counties.`);
  if (new Set(mGeoms.map((g) => g.properties.code)).size !== EXPECT.municipalities) fail("Municipality codes are not unique.");

  for (const g of mGeoms) {
    const code = g.properties.code;
    g.properties = { ...g.properties, name: NAME_FIX[code] ?? cleanName(g.properties.name), name_en: EN_FIX[code] ?? cleanName(g.properties.name_en) };
  }
  writeFileSync(path.join(ROOT, "public/geo/albania-municipalities.topo.json"), JSON.stringify(muni));
  writeFileSync(path.join(ROOT, "public/geo/albania-counties.topo.json"), JSON.stringify(counties));

  // Centroids (spherical) and neighbours (municipalities that share a border arc).
  const fc = feature(muni, muni.objects.municipalities) as unknown as { features: { properties: Record<string, string>; geometry: GeoJSON.Geometry; type: "Feature" }[] };
  const adj = neighbors(muni.objects.municipalities.geometries);
  const cfc = feature(counties, counties.objects.counties) as unknown as { features: { properties: Record<string, string>; geometry: GeoJSON.Geometry; type: "Feature" }[] };

  // Optional verified population (INSTAT); empty file means "unknown", never guessed.
  const popFile = path.join(ROOT, "data/geo/population.csv");
  if (!existsSync(popFile)) writeFileSync(popFile, "region_code,population,source_year\n");
  const pop = new Map<string, { population: number; year: number }>();
  for (const line of readFileSync(popFile, "utf8").split(/\r?\n/).slice(1)) {
    const [code, p, y] = line.split(",").map((s) => s.trim());
    if (code && p && Number(p) > 0) pop.set(code, { population: Number(p), year: Number(y) || 0 });
  }

  const regions = [
    ...cfc.features.map((f) => {
      const [lng, lat] = geoCentroid(f);
      return { code: String(f.properties!.code), name_sq: String(f.properties!.name), name_en: String(f.properties!.name_en), level: "county", parent_code: null, centroid_lat: +lat.toFixed(5), centroid_lng: +lng.toFixed(5), neighbors: [] as string[], population: null as number | null, population_year: null as number | null };
    }),
    ...fc.features.map((f, i) => {
      const [lng, lat] = geoCentroid(f);
      const p = pop.get(String(f.properties!.code));
      return {
        code: String(f.properties!.code),
        name_sq: String(f.properties!.name),
        name_en: String(f.properties!.name_en),
        level: "municipality",
        parent_code: String(f.properties!.county),
        centroid_lat: +lat.toFixed(5),
        centroid_lng: +lng.toFixed(5),
        neighbors: adj[i].map((j) => String(mGeoms[j].properties.code)).sort(),
        population: p?.population ?? null,
        population_year: p?.year ?? null,
      };
    }),
  ].sort((a, b) => a.code.localeCompare(b.code));

  const isolated = regions.filter((r) => r.level === "municipality" && r.neighbors.length === 0);
  writeFileSync(path.join(ROOT, "data/geo/regions.json"), `${JSON.stringify({ source: "OCHA COD-AB Albania 2019 (CC BY-IGO)", regions }, null, 1)}\n`);

  const size = (f: string) => `${(statSync(path.join(ROOT, f)).size / 1024).toFixed(0)} KB`;
  console.log(`✓ ${EXPECT.municipalities} municipalities, ${EXPECT.counties} counties (simplify ${pct}%)`);
  console.log(`  public/geo/albania-municipalities.topo.json ${size("public/geo/albania-municipalities.topo.json")}`);
  console.log(`  public/geo/albania-counties.topo.json       ${size("public/geo/albania-counties.topo.json")}`);
  console.log(`  data/geo/regions.json · populations known: ${pop.size}/61 · municipalities without neighbours: ${isolated.map((r) => r.name_sq).join(", ") || "none"}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
