/**
 * Hexagon tile map: one hexagon per municipality, centroid snapped to a hex grid with greedy
 * collision resolution, so small municipalities (Tirana area) are as visible as large rural ones.
 * Tries several grid sizes and orders and keeps the layout that preserves the most real borders.
 *
 *   npm run geo:hex   (after npm run geo:build)  →  public/geo/hex-layout.json, data/geo/regions.json (hex_q/hex_r)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { adjacencyScore, layoutHexes, type HexInput } from "../src/lib/geo/hex";

const ROOT = path.resolve(import.meta.dirname, "..");
const file = path.join(ROOT, "data/geo/regions.json");
const data = JSON.parse(readFileSync(file, "utf8")) as { source: string; regions: { code: string; level: string; centroid_lat: number; centroid_lng: number; neighbors: string[]; hex_q?: number | null; hex_r?: number | null }[] };
const items: HexInput[] = data.regions.filter((r) => r.level === "municipality").map((r) => ({ code: r.code, lat: r.centroid_lat, lng: r.centroid_lng, neighbors: r.neighbors }));
if (items.length !== 61) throw new Error(`expected 61 municipalities, found ${items.length}`);

let best: { layout: Record<string, { q: number; r: number }>; score: number; size: number; order: string } | null = null;
for (const size of [9, 10, 11, 12, 13, 14, 15, 16]) {
  for (const order of ["north", "crowded"] as const) {
    const layout = layoutHexes(items, size, order);
    const score = adjacencyScore(items, layout);
    if (!best || score > best.score) best = { layout, score, size, order };
  }
}
const { layout, score, size, order } = best!;
const cells = new Set(Object.values(layout).map((a) => `${a.q},${a.r}`));
if (cells.size !== 61) throw new Error("two municipalities share a hex");

writeFileSync(path.join(ROOT, "public/geo/hex-layout.json"), `${JSON.stringify({ size_km: size, order, adjacency: +score.toFixed(3), cells: layout }, null, 1)}\n`);
for (const r of data.regions) if (layout[r.code]) Object.assign(r, { hex_q: layout[r.code].q, hex_r: layout[r.code].r });
writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
console.log(`✓ hex layout: 61 cells, grid ${size} km (${order} first), ${(score * 100).toFixed(0)}% of real borders kept as hex neighbours`);
