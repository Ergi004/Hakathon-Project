/**
 * Geographic Threat Map demo seed (idempotent, secret key, SYNTHETIC DATA).
 *
 *   npm run seed:geo
 *
 * 1. Loads the 12 counties + 61 municipalities, neighbours and hex cells from data/geo/regions.json
 *    (built by npm run geo:build && npm run geo:hex from OCHA COD-AB 2019). Populations only if
 *    data/geo/population.csv holds verified INSTAT figures.
 * 2. Places municipal institutions on the map ("Bashkia Pogradec" → Pogradec) and sets
 *    campaigns.target_region_id from them. National institutions get no region.
 * 3. Replaces the previous demo reports (protocol DEMO-…) with ~600 synthetic reports over the
 *    last 30 days, region_source = 'synthetic', ~12 % without a region, plus three stories:
 *    F019 parking-fine QR spike in Pogradec and neighbours (last 5 days), a bank-verification
 *    campaign in Tirana and Durrës, and fake jobs (F064) in Vlorë.
 * All domains end in .example/.test; bank and job institutions are fictional ("…Shembull").
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { requireEnv } from "./lib/env";
import { chunks, must, scriptClient, type ScriptClient } from "./lib/supabase";

type Region = { code: string; name_sq: string; name_en: string; level: "county" | "municipality"; parent_code: string | null; centroid_lat: number; centroid_lng: number; neighbors: string[]; population: number | null; population_year: number | null; hex_q?: number; hex_r?: number };

const ROOT = path.resolve(import.meta.dirname, "..");
const DAY = 86_400_000;

/** Deterministic PRNG so every run produces the same demo picture. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function loadRegions(db: ScriptClient) {
  const { regions } = JSON.parse(readFileSync(path.join(ROOT, "data/geo/regions.json"), "utf8")) as { regions: Region[] };
  const counties = regions.filter((r) => r.level === "county");
  const munis = regions.filter((r) => r.level === "municipality");
  if (counties.length !== 12 || munis.length !== 61) throw new Error(`regions.json has ${counties.length} counties / ${munis.length} municipalities; run npm run geo:build && npm run geo:hex`);
  const base = (r: Region) => ({ code: r.code, name_sq: r.name_sq, name_en: r.name_en, level: r.level, population: r.population, population_year: r.population_year, centroid_lat: r.centroid_lat, centroid_lng: r.centroid_lng, hex_q: r.hex_q ?? null, hex_r: r.hex_r ?? null });
  must(await db.from("regions").upsert(counties.map(base), { onConflict: "code" }), "upsert counties");
  const ids = new Map(must(await db.from("regions").select("id, code"), "read regions").map((r) => [r.code, r.id]));
  must(await db.from("regions").upsert(munis.map((m) => ({ ...base(m), parent_id: ids.get(m.parent_code!)! })), { onConflict: "code" }), "upsert municipalities");
  for (const r of must(await db.from("regions").select("id, code"), "read regions")) ids.set(r.code, r.id);
  const pairs = munis.flatMap((m) => m.neighbors.map((n) => ({ region_id: ids.get(m.code)!, neighbor_id: ids.get(n)! })));
  for (const c of chunks(pairs, 500)) must(await db.from("region_neighbors").upsert(c, { onConflict: "region_id,neighbor_id", ignoreDuplicates: true }), "neighbours");
  return { ids, munis, pairs: pairs.length, populations: munis.filter((m) => m.population).length };
}

const MUNICIPAL = [
  { slug: "bashkia-pogradec", name: "Bashkia Pogradec", code: "AL0705" },
  { slug: "bashkia-tirane", name: "Bashkia Tiranë", code: "AL1105" },
  { slug: "bashkia-durres", name: "Bashkia Durrës", code: "AL0301" },
  { slug: "bashkia-vlore", name: "Bashkia Vlorë", code: "AL1207" },
  { slug: "bashkia-shkoder", name: "Bashkia Shkodër", code: "AL1004" },
];
const NATIONAL = [
  { slug: "e-albania", name: "e-Albania", sector: "government" },
  { slug: "posta-shqiptare", name: "Posta Shqiptare", sector: "postal" },
  { slug: "issh", name: "ISSH", sector: "government" },
  { slug: "policia-rrugore", name: "Policia Rrugore", sector: "police" },
  { slug: "energji-shembull", name: "Energji Shembull", sector: "utility" },
  { slug: "drejtoria-e-tatimeve", name: "Drejtoria e Tatimeve", sector: "government" },
  { slug: "banka-shembull", name: "Banka Shembull", sector: "bank" },
  { slug: "puna-shembull", name: "Puna Shembull", sector: "other" },
];

async function placeInstitutions(db: ScriptClient, ids: Map<string, string>, munis: Region[]) {
  for (const m of MUNICIPAL) {
    const existing = must(await db.from("institutions").select("id").eq("slug", m.slug).maybeSingle(), "find institution");
    if (existing) must(await db.from("institutions").update({ region_id: ids.get(m.code)! }).eq("id", existing.id), "place institution");
    else must(await db.from("institutions").insert({ slug: m.slug, name: m.name, sector: "municipality", region_id: ids.get(m.code)! }), "create institution");
  }
  for (const n of NATIONAL) {
    const existing = must(await db.from("institutions").select("id").eq("slug", n.slug).maybeSingle(), "find institution");
    if (!existing) must(await db.from("institutions").insert({ slug: n.slug, name: n.name, sector: n.sector }), "create institution");
    else must(await db.from("institutions").update({ region_id: null }).eq("id", existing.id), "national institution");
  }
  // Any other "Bashkia X" institution (e.g. from the dataset seed) gets its municipality by name.
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const byName = new Map(munis.map((m) => [fold(m.name_sq), m.code]));
  for (const i of must(await db.from("institutions").select("id, name, region_id").ilike("name", "Bashkia %"), "municipal institutions")) {
    const code = byName.get(fold(i.name.replace(/^Bashkia\s+/i, "")));
    if (code && !i.region_id) must(await db.from("institutions").update({ region_id: ids.get(code)! }).eq("id", i.id), "place institution");
  }
  return new Map(must(await db.from("institutions").select("id, slug, region_id"), "institutions").map((i) => [i.slug, i]));
}

const CAMPAIGNS = [
  { code: "F019", tactic: "parking_fine_qr", inst: "bashkia-pogradec", name: "Bashkia Pogradec: gjobë parkimi (QR)", channels: ["qr", "sms"] },
  { code: "F064", tactic: "fake_job", inst: "puna-shembull", name: "Puna Shembull: punë e rreme jashtë vendit", channels: ["social", "web"] },
  { code: "DEMO-BANK", tactic: "bank_verification", inst: "banka-shembull", name: "Banka Shembull: verifikim llogarie", channels: ["sms", "email"] },
  { code: "DEMO-PARCEL", tactic: "parcel_fee", inst: "posta-shqiptare", name: "Posta Shqiptare: tarifë pakoje", channels: ["sms"] },
  { code: "DEMO-EALB", tactic: "credential_phish", inst: "e-albania", name: "e-Albania: rifreskim llogarie", channels: ["email", "sms"] },
  { code: "DEMO-TAX", tactic: "tax_refund", inst: "drejtoria-e-tatimeve", name: "Drejtoria e Tatimeve: rimbursim", channels: ["email"] },
  { code: "DEMO-POWER", tactic: "utility_bill", inst: "energji-shembull", name: "Energji Shembull: faturë e papaguar", channels: ["sms"] },
  { code: "DEMO-TRAFFIC", tactic: "traffic_fine", inst: "policia-rrugore", name: "Policia Rrugore: gjobë trafiku", channels: ["sms"] },
  { code: "DEMO-TIR-PARK", tactic: "parking_fine_qr", inst: "bashkia-tirane", name: "Bashkia Tiranë: gjobë parkimi", channels: ["qr", "sms"] },
  { code: "DEMO-SHK-TAX", tactic: "local_tax", inst: "bashkia-shkoder", name: "Bashkia Shkodër: taksë vendore", channels: ["sms", "email"] },
] as const;

async function ensureCampaigns(db: ScriptClient, insts: Map<string, { id: string; region_id: string | null }>) {
  const out = new Map<string, string>();
  for (const c of CAMPAIGNS) {
    const inst = insts.get(c.inst)!;
    const existing = must(await db.from("campaigns").select("id").eq("code", c.code).maybeSingle(), "find campaign");
    const row = { institution_id: inst.id, target_region_id: inst.region_id };
    if (existing) {
      must(await db.from("campaigns").update(row).eq("id", existing.id), "update campaign");
      out.set(c.code, existing.id);
    } else {
      const created = must(await db.from("campaigns").insert({ code: c.code, tactic: c.tactic, imitated_name: c.name, status: "confirmed", severity: c.code === "F019" ? "high" : "medium", source: "manual", summary: "Synthetic demo campaign (seed-geo).", ...row }).select("id").single(), "create campaign");
      out.set(c.code, created.id);
    }
  }
  return out;
}

async function main() {
  requireEnv("SUPABASE_SECRET_KEY");
  const db = scriptClient();
  const rand = rng(20261120);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

  console.log("Mburoja geo seed — ⚠ SYNTHETIC DEMO DATA ⚠\n");
  const { ids, munis, pairs, populations } = await loadRegions(db);
  console.log(`regions: 12 counties, 61 municipalities, ${pairs} neighbour links, populations ${populations}/61`);
  const insts = await placeInstitutions(db, ids, munis);
  const camps = await ensureCampaigns(db, insts);
  console.log(`institutions placed: ${MUNICIPAL.length} municipal, ${NATIONAL.length} national · campaigns: ${camps.size}`);

  // Replace the previous demo reports (the trigger keeps region_daily_stats in step).
  const old = must(await db.from("reports").select("id").like("protocol", "DEMO-%"), "old demo");
  for (const c of chunks(old.map((r) => r.id), 200)) must(await db.from("reports").delete().in("id", c), "delete demo");

  const now = Date.now();
  const byCode = new Map(munis.map((m) => [m.code, m]));
  const weights = munis.map((m) => m.population ?? 1);
  const wSum = weights.reduce((s, w) => s + w, 0);
  const weighted = () => { let x = rand() * wSum; for (let i = 0; i < munis.length; i++) { x -= weights[i]; if (x <= 0) return munis[i].code; } return munis[munis.length - 1].code; };
  const background = CAMPAIGNS.filter((c) => !["F019", "F064", "DEMO-BANK"].includes(c.code));
  type Row = { code: string | null; campaign: string; daysAgo: number };
  const plan: Row[] = [];

  // Background noise: even spread (no populations) over 30 days, ~12 % without a region.
  for (let i = 0; i < 390; i++) plan.push({ code: rand() < 0.12 ? null : weighted(), campaign: pick(background).code, daysAgo: rand() * 30 });
  // Story 1: F019 Pogradec parking-fine QR spike in the last 5 days, spilling into neighbours.
  const pogradec = "AL0705";
  for (let i = 0; i < 4; i++) plan.push({ code: pogradec, campaign: "F019", daysAgo: 8 + rand() * 20 });
  for (let i = 0; i < 46; i++) plan.push({ code: rand() < 0.08 ? null : pogradec, campaign: "F019", daysAgo: rand() * 5 });
  for (const n of byCode.get(pogradec)!.neighbors) for (let i = 0; i < 11; i++) plan.push({ code: n, campaign: "F019", daysAgo: rand() * 5 });
  // Story 2: bank verification concentrated in Tirana and Durrës (whole month, rising).
  for (let i = 0; i < 44; i++) plan.push({ code: rand() < 0.1 ? null : "AL1105", campaign: "DEMO-BANK", daysAgo: Math.pow(rand(), 1.6) * 30 });
  for (let i = 0; i < 26; i++) plan.push({ code: "AL0301", campaign: "DEMO-BANK", daysAgo: Math.pow(rand(), 1.6) * 30 });
  // Story 3: fake jobs (F064) in Vlorë, mostly the last 10 days.
  for (let i = 0; i < 30; i++) plan.push({ code: rand() < 0.1 ? null : "AL1207", campaign: "F064", daysAgo: rand() < 0.8 ? rand() * 10 : 10 + rand() * 20 });

  const flags = [[25, "yellow"], [45, "orange"], [68, "red"], [88, "darkred"]] as const;
  const rows = plan.map((p, i) => {
    const c = CAMPAIGNS.find((x) => x.code === p.campaign)!;
    const [score, flag] = pick(c.code === "F019" || c.code === "DEMO-BANK" ? flags.slice(2) : flags.slice(1));
    const src = rand();
    return {
      protocol: `DEMO-${String(i + 1).padStart(6, "0")}`,
      source: src < 0.7 ? ("citizen_report" as const) : src < 0.9 ? ("extension" as const) : ("business" as const),
      status: rand() < 0.3 ? ("confirmed" as const) : rand() < 0.5 ? ("under_review" as const) : ("received" as const),
      channel: pick(c.channels),
      score: score + Math.floor(rand() * 8),
      flag,
      campaign_id: camps.get(c.code)!,
      region_id: p.code ? ids.get(p.code)! : null,
      region_source: p.code ? ("synthetic" as const) : null,
      created_at: new Date(now - p.daysAgo * DAY).toISOString(),
      resolution_note: "Synthetic demo report (seed-geo). Not real data.",
    };
  });
  for (const c of chunks(rows, 150)) must(await db.from("reports").insert(c), "insert demo reports");

  // Safety net: rebuild the aggregates from scratch (also covers campaign/institution moves).
  const rebuilt = must(await db.rpc("rebuild_region_stats"), "rebuild_region_stats");

  console.log(`\nSYNTHETIC reports inserted: ${rows.length} (protocol DEMO-000001…), ${rows.filter((r) => !r.region_id).length} without a region`);
  console.table([
    { story: "F019 parking-fine QR", where: "Pogradec + neighbours, last 5 days", reports: rows.filter((r) => r.campaign_id === camps.get("F019")).length },
    { story: "Bank verification (DEMO-BANK)", where: "Tirana, Durrës", reports: rows.filter((r) => r.campaign_id === camps.get("DEMO-BANK")).length },
    { story: "Fake jobs (F064)", where: "Vlorë", reports: rows.filter((r) => r.campaign_id === camps.get("F064")).length },
    { story: "Background", where: "all municipalities", reports: 390 },
  ]);
  console.log(`region_daily_stats rebuilt from ${rebuilt} reports.`);

  // Hot spots: ask the running app to compute them now (otherwise the 10-minute cron will).
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const secret = process.env.CRON_SECRET;
  try {
    if (!secret) throw new Error("no CRON_SECRET");
    const res = await fetch(`${appUrl}/api/cron/compute-geo-hotspots`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60_000) });
    console.log(`compute-geo-hotspots: HTTP ${res.status} ${JSON.stringify(await res.json().catch(() => ({})))}`);
  } catch {
    console.log("Hot spots not computed yet: start the app (npm run dev) and run  npm run cron:run compute-geo-hotspots");
  }
  console.log("\nDone. Open /soc/geo (staff). The map shows a “Demo data” badge while most reports are synthetic.");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
