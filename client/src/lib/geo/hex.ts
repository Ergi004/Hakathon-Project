/** Axial hex-grid helpers (pointy-top). Pure: shared by the build script, the map and tests. */
export interface Axial { q: number; r: number }

export const SQRT3 = Math.sqrt(3);

export function axialToPixel({ q, r }: Axial, size: number): [number, number] {
  return [size * SQRT3 * (q + r / 2), size * 1.5 * r];
}

export function pixelToAxial(x: number, y: number, size: number): Axial {
  const qf = ((SQRT3 / 3) * x - y / 3) / size;
  const rf = ((2 / 3) * y) / size;
  return cubeRound(qf, rf);
}

export function cubeRound(qf: number, rf: number): Axial {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
}

export const HEX_DIRS: Axial[] = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];

export function ring(center: Axial, k: number): Axial[] {
  if (k === 0) return [center];
  const out: Axial[] = [];
  let cur = { q: center.q + HEX_DIRS[4].q * k, r: center.r + HEX_DIRS[4].r * k };
  for (let side = 0; side < 6; side++) {
    for (let i = 0; i < k; i++) {
      out.push(cur);
      cur = { q: cur.q + HEX_DIRS[side].q, r: cur.r + HEX_DIRS[side].r };
    }
  }
  return out;
}

export const hexDistance = (a: Axial, b: Axial) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

/** Corner points of a pointy-top hexagon centred at (cx, cy), for an SVG polygon. */
export function hexCorners(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

export interface HexInput { code: string; lat: number; lng: number; neighbors: string[] }

/**
 * Snap centroids onto a hex grid (local equirectangular km projection, y down) and resolve
 * collisions greedily: each region takes the free cell closest to its true position.
 */
export function layoutHexes(items: HexInput[], sizeKm: number, order: "north" | "crowded"): Record<string, Axial> {
  const lat0 = items.reduce((s, i) => s + i.lat, 0) / items.length;
  const lng0 = items.reduce((s, i) => s + i.lng, 0) / items.length;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const pts = items.map((i) => ({ ...i, x: (i.lng - lng0) * kx, y: -(i.lat - lat0) * 110.57 }));
  const crowd = (p: (typeof pts)[number]) => pts.filter((o) => Math.hypot(o.x - p.x, o.y - p.y) < sizeKm * 2.2).length;
  const ordered = [...pts].sort(order === "north" ? (a, b) => a.y - b.y || a.code.localeCompare(b.code) : (a, b) => crowd(b) - crowd(a) || a.code.localeCompare(b.code));
  const taken = new Map<string, string>();
  const out: Record<string, Axial> = {};
  for (const p of ordered) {
    const ideal = pixelToAxial(p.x, p.y, sizeKm);
    let best: Axial | null = null;
    let bestD = Infinity;
    for (let k = 0; k <= 8 && !best; k++) {
      for (const c of ring(ideal, k)) {
        if (taken.has(`${c.q},${c.r}`)) continue;
        const [cx, cy] = axialToPixel(c, sizeKm);
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    if (!best) throw new Error(`no free hex for ${p.code}`);
    taken.set(`${best.q},${best.r}`, p.code);
    out[p.code] = best;
  }
  return out;
}

/** Share of real neighbour pairs that are also adjacent hexes (higher is better). */
export function adjacencyScore(items: HexInput[], layout: Record<string, Axial>): number {
  let pairs = 0, kept = 0;
  for (const i of items) for (const n of i.neighbors) {
    if (n < i.code || !layout[n]) continue;
    pairs += 1;
    if (hexDistance(layout[i.code], layout[n]) === 1) kept += 1;
  }
  return pairs ? kept / pairs : 1;
}
