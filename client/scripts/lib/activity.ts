/**
 * Simulated app activity for `npm run seed -- --sample N` (SYNTHETIC DATA).
 *
 * Takes a random sample of the dataset messages and turns each into a report filed by one of
 * N seeded citizens, spread over the last `days` days (each campaign keeps its real duration,
 * moved to a random point in the year), with a synthetic municipality so the geographic map,
 * hot zones and every SOC / citizen panel have something to show.
 */
import { createHash } from "node:crypto";
import { MUNICIPALITIES, NEIGHBORS } from "../../src/lib/geo/regions";
import type { Database, TablesInsert } from "../../src/types/database";
import { chunks, must, type ScriptClient } from "./supabase";
import type { Row } from "./csv";

type Enums = Database["public"]["Enums"];
const DAY = 86_400_000;

export interface ActivityOptions { sample: number; citizens: number; days: number }

/** --sample 6000 --citizens 200 --days 365 (sample 0 = classic full seed). */
export function parseActivityArgs(argv: string[]): ActivityOptions {
  const get = (name: string, def: number) => {
    const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (i < 0) return def;
    const v = argv[i].includes("=") ? argv[i].split("=")[1] : argv[i + 1];
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
  };
  return { sample: get("sample", 0), citizens: get("citizens", 200), days: get("days", 365) };
}

/** Deterministic PRNG: the same command gives the same picture. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const stableId = (seed: string) => { const h = createHash("sha256").update(seed).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };

/** Random sample: ~80 % phishing, ~20 % legitimate (people mostly report scams). */
export function sampleMessages(rows: Row[], idCol: string, labelOf: Map<string, 0 | 1 | null>, n: number, rand: () => number): Row[] {
  const shuffle = <T,>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };
  const phish = shuffle(rows.filter((r) => labelOf.get(r[idCol]) === 1));
  const legit = shuffle(rows.filter((r) => labelOf.get(r[idCol]) !== 1));
  const nPhish = Math.min(phish.length, Math.round(n * 0.8));
  return shuffle([...phish.slice(0, nPhish), ...legit.slice(0, n - nPhish)]);
}

/** Each campaign keeps its real duration, moved to a random point in the last `days` days. ~15 % are active now. */
export function planCampaignWindows(campRows: Row[], codeCol: string, startCol: string | null, endCol: string | null, days: number, rand: () => number) {
  const now = Date.now();
  const out = new Map<string, { start: number; end: number }>();
  for (const r of campRows) {
    const s = startCol ? Date.parse(r[startCol]) : NaN, e = endCol ? Date.parse(r[endCol]) : NaN;
    const dur = Math.min(days * 0.6, Math.max(2, Number.isFinite(s) && Number.isFinite(e) ? (e - s) / DAY : 14 + rand() * 30));
    const endAgo = rand() < 0.15 ? rand() * 6 : rand() * (days - dur);
    out.set(r[codeCol].trim(), { start: now - (endAgo + dur) * DAY, end: now - endAgo * DAY });
  }
  return out;
}

/** A plausible local time (more in the day than at night). */
function atLocalTime(dayStart: number, rand: () => number) {
  const hour = rand() < 0.85 ? 7 + rand() * 15 : rand() * 24;
  return new Date(Math.floor(dayStart / DAY) * DAY + (hour - 1) * 3_600_000 + rand() * 3_600_000);
}

export function planDates(rows: Row[], idCol: string, campCol: string | null, windows: Map<string, { start: number; end: number }>, days: number, rand: () => number) {
  const now = Date.now();
  const out = new Map<string, Date>();
  for (const r of rows) {
    const w = campCol && r[campCol] ? windows.get(r[campCol].trim()) : undefined;
    const t = w ? w.start + rand() * (w.end - w.start) : now - rand() * days * DAY;
    const d = atLocalTime(Math.min(t, now - 3_600_000), rand);
    out.set(r[idCol], d.getTime() > now ? new Date(now - rand() * 6 * 3_600_000) : d);
  }
  return out;
}

// ---- Geography (synthetic sampling weights: larger towns get more reports; NOT populations) ----
const TOWN_WEIGHT: Record<string, number> = {
  AL1105: 10, AL0301: 5, AL0403: 3.5, AL1207: 3.5, AL1004: 3.5, AL0502: 3.5, AL0703: 3, AL1101: 3, AL0101: 2, AL0503: 2.2,
  AL1102: 1.6, AL0705: 1.6, AL1205: 1.4, AL0902: 1.6, AL0602: 1.2, AL0802: 1.2, AL0302: 1.3, AL0901: 1.2, AL0102: 1, AL0505: 1,
};
const weightOf = (code: string) => TOWN_WEIGHT[code] ?? 0.7;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function weightedPicker(codes: string[], rand: () => number) {
  const w = codes.map(weightOf);
  const sum = w.reduce((a, b) => a + b, 0);
  return () => { let x = rand() * sum; for (let i = 0; i < codes.length; i++) { x -= w[i]; if (x <= 0) return codes[i]; } return codes[codes.length - 1]; };
}

/** "Bashkia Fier", "Bashkisë Durrës", "Bashkia e Tiranës" → municipality code (by name). */
export function detectMunicipality(text: string): string | null {
  const m = text.match(/Bashki(?:a|s[eë]|n[eë])\s+(?:e\s+)?([A-ZÇË][A-Za-zÇËçë]+(?:\s+[A-ZÇË][A-Za-zÇËçë]+)?)/);
  if (!m) return null;
  const cand = fold(m[1]);
  for (const r of MUNICIPALITIES) {
    const f = fold(r.name_sq), e = fold(r.name_en);
    if (cand === f || cand === e || (cand.length >= 4 && (cand.startsWith(f.slice(0, -1)) || cand.startsWith(e.slice(0, -1))))) return r.code;
  }
  return null;
}

const FIRST = ["Arta", "Besa", "Blerina", "Dorina", "Elira", "Erisa", "Fjona", "Gentiana", "Ilda", "Jonida", "Klea", "Lediana", "Mirela", "Nora", "Orjeta", "Rea", "Sara", "Teuta", "Vjosa", "Xhesika", "Ardit", "Besnik", "Dritan", "Elton", "Ermal", "Fatjon", "Gëzim", "Ilir", "Jetmir", "Klodian", "Luan", "Marsel", "Nertil", "Olsi", "Petrit", "Redi", "Sokol", "Taulant", "Valon", "Xhoni"];
const LAST = ["Hoxha", "Shehu", "Leka", "Gjoka", "Krasniqi", "Dervishi", "Basha", "Çela", "Kola", "Marku", "Prifti", "Rama", "Sula", "Tafa", "Vata", "Zeneli", "Bregu", "Duka", "Ferra", "Hasani", "Kurti", "Malaj", "Ndreu", "Qose", "Toska"];

export interface ActivityInput {
  db: ScriptClient;
  opts: ActivityOptions;
  demoPassword: string;
  campRows: Row[];
  allMsgRows: Row[];
  sampled: Row[];
  dates: Map<string, Date>;
  cols: { msgId: string; msgCamp: string | null; msgText: string; msgSender: string | null; msgSubject: string | null; campCode: string; campInst: string };
  analystId: string;
  bankOrgId: string;
  rand: () => number;
}

export async function seedActivity(a: ActivityInput) {
  const { db, opts, rand } = a;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const now = Date.now();

  // 0. Remove the separate seed-geo demo stories (DEMO-… reports and campaigns) to avoid duplicates.
  for (;;) {
    const ids = must(await db.from("reports").select("id").like("protocol", "DEMO-%").limit(500), "demo reports").map((r) => r.id);
    if (!ids.length) break;
    must(await db.from("reports").delete().in("id", ids), "delete demo reports");
  }
  must(await db.from("campaigns").delete().like("code", "DEMO-%"), "delete demo campaigns");

  // 1. Regions (loaded by npm run seed:geo).
  const regionId = new Map(must(await db.from("regions").select("id, code"), "regions").map((r) => [r.code, r.id]));
  if (regionId.size < 73) throw new Error("Regions are not loaded. Run npm run seed:geo first (it loads the 61 municipalities).");
  const muniCodes = MUNICIPALITIES.map((m) => m.code);
  const anyTown = weightedPicker(muniCodes, rand);

  // 2. Municipal campaigns: find the imitated municipality from the messages ("Bashkia Fier") and
  //    place a dedicated institution on the map; other campaigns inherit their institution's region.
  const votes = new Map<string, Map<string, number>>();
  if (a.cols.msgCamp) {
    for (const r of a.allMsgRows) {
      const code = r[a.cols.msgCamp]?.trim();
      if (!code) continue;
      const muni = detectMunicipality(`${a.cols.msgSender ? r[a.cols.msgSender] : ""} ${a.cols.msgSubject ? r[a.cols.msgSubject] : ""} ${r[a.cols.msgText] ?? ""}`);
      if (!muni) continue;
      const m = votes.get(code) ?? new Map<string, number>();
      m.set(muni, (m.get(muni) ?? 0) + 1);
      votes.set(code, m);
    }
  }
  const campaigns = must(await db.from("campaigns").select("id, code, institution_id, institutions(name, region_id)"), "campaigns");
  const campHome = new Map<string, string | null>();
  const localCampaign = new Set<string>();
  let municipalCampaigns = 0;
  for (const c of campaigns) {
    const inst = c.institutions as { name: string; region_id: string | null } | null;
    const isMunicipal = /^bashkia$/i.test(inst?.name ?? "") || /^bashkia\s/i.test(inst?.name ?? "");
    const v = votes.get(c.code);
    const top = v ? [...v.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] : undefined;
    if (isMunicipal && top) {
      const m = MUNICIPALITIES.find((x) => x.code === top)!;
      const slug = `bashkia-${fold(m.name_sq).replace(/[^a-z0-9]+/g, "-")}`;
      must(await db.from("institutions").upsert({ slug, name: `Bashkia ${m.name_sq}`, sector: "municipality", region_id: regionId.get(top)! }, { onConflict: "slug" }), "municipal institution");
      const instId = must(await db.from("institutions").select("id").eq("slug", slug).single(), "institution").id;
      must(await db.from("campaigns").update({ institution_id: instId, imitated_name: `Bashkia ${m.name_sq}`, target_region_id: regionId.get(top)! }).eq("id", c.id), "campaign region");
      must(await db.from("messages").update({ institution_id: instId }).eq("campaign_id", c.id), "message institution");
      campHome.set(c.code, top);
      localCampaign.add(c.code);
      municipalCampaigns += 1;
    } else {
      must(await db.from("campaigns").update({ target_region_id: inst?.region_id ?? null }).eq("id", c.id), "campaign region");
      // National campaign: one or two regional focus areas make realistic clusters.
      campHome.set(c.code, rand() < 0.7 ? anyTown() : null);
    }
  }

  // 3. Citizens: citizen001…citizenNNN@demo.example, all with DEMO_PASSWORD, each with a home town.
  const existing = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) if (u.email) existing.set(u.email, u.id);
    if (data.users.length < 1000) break;
  }
  const citizens: { id: string; home: string; locale: "sq" | "en"; name: string }[] = [];
  for (let i = 1; i <= opts.citizens; i++) {
    const email = `citizen${String(i).padStart(3, "0")}@demo.example`;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    let id = existing.get(email);
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({ email, password: a.demoPassword, email_confirm: true, user_metadata: { full_name: name } });
      if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
      id = data.user.id;
    }
    citizens.push({ id, home: anyTown(), locale: rand() < 0.85 ? "sq" : "en", name });
  }
  for (const part of chunks(citizens, 100)) {
    must(await db.from("profiles").upsert(part.map((c) => ({ id: c.id, full_name: c.name, locale: c.locale, platform_role: "user" as const, created_at: new Date(now - (60 + rand() * (opts.days - 60)) * DAY).toISOString() })), { onConflict: "id" }), "citizen profiles");
  }
  const byHome = new Map<string, typeof citizens>();
  for (const c of citizens) byHome.set(c.home, [...(byHome.get(c.home) ?? []), c]);

  // 4. Reports: one per sampled message.
  const savedMsg = new Map<string, { id: string; score: number | null; flag: Enums["flag_level"] | null; channel: Enums["msg_channel"]; campaign_id: string | null; label: Enums["msg_label"] }>();
  for (const part of chunks(a.sampled.map((r) => r[a.cols.msgId]), 300)) {
    for (const m of must(await db.from("messages").select("id, external_id, score, flag, channel, campaign_id, label").in("external_id", part), "messages")) savedMsg.set(m.external_id!, m);
  }
  // Municipal campaigns cluster around the imitated municipality; national ones around a focus town.
  const regionFor = (campCode: string | undefined): string | null => {
    if (rand() < 0.1) return null;                                        // "Prefer not to say"
    const home = campCode ? campHome.get(campCode) : null;
    if (home) {
      const local = localCampaign.has(campCode!);
      const x = rand();
      if (x < (local ? 0.65 : 0.4)) return home;
      if (x < (local ? 0.85 : 0.55)) return pick(NEIGHBORS.get(home) ?? [home]);
    }
    return anyTown();
  };

  type Rep = TablesInsert<"reports"> & { _ext: string };
  const reports: Rep[] = [];
  // Re-runs keep each report's protocol (dates shift with "now", so numbering by date would reassign
  // protocols and break the unique constraint and existing links). New reports continue after the
  // highest number already used in that year.
  const existingProtocol = new Map<string, string>();
  const perYear = new Map<number, number>();
  const plannedIds = a.sampled.map((r) => stableId(`activity:${r[a.cols.msgId]}`));
  for (const part of chunks(plannedIds, 300)) {
    for (const r of must(await db.from("reports").select("id, protocol").in("id", part), "existing protocols")) existingProtocol.set(r.id, r.protocol);
  }
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("reports").select("protocol").like("protocol", "SOC-%").range(from, from + 999), "protocols");
    for (const { protocol } of page) {
      const m = protocol.match(/^SOC-(\d{4})\/(\d+)$/);
      if (m) perYear.set(Number(m[1]), Math.max(perYear.get(Number(m[1])) ?? 100_000, Number(m[2])));
    }
    if (page.length < 1000) break;
  }
  const ordered = [...a.sampled].sort((x, y) => a.dates.get(x[a.cols.msgId])!.getTime() - a.dates.get(y[a.cols.msgId])!.getTime());
  for (const r of ordered) {
    const ext = r[a.cols.msgId];
    const m = savedMsg.get(ext);
    if (!m) continue;
    const created = a.dates.get(ext)!;
    const campCode = a.cols.msgCamp ? r[a.cols.msgCamp]?.trim() || undefined : undefined;
    const region = regionFor(campCode);
    const local = region ? byHome.get(region) : undefined;
    const reporter = local?.length && rand() < 0.85 ? pick(local) : pick(citizens);
    const ageDays = (now - created.getTime()) / DAY;
    const phishing = m.label === "phishing";
    const s = rand();
    const status: Enums["report_status"] = !phishing
      ? ageDays < 4 ? (s < 0.6 ? "received" : "under_review") : s < 0.9 ? "not_scam" : "duplicate"
      : ageDays < 2 ? (s < 0.65 ? "received" : "under_review")
      : ageDays < 14 ? (s < 0.2 ? "received" : s < 0.5 ? "under_review" : s < 0.85 ? "confirmed" : "takedown_requested")
      : s < 0.45 ? "confirmed" : s < 0.6 ? "takedown_requested" : s < 0.85 ? "taken_down" : s < 0.93 ? "duplicate" : "not_scam";
    const src = rand();
    const source: Enums["report_source"] = src < 0.68 ? "citizen_report" : src < 0.86 ? "extension" : src < 0.95 ? "citizen_check" : "business";
    const id = stableId(`activity:${ext}`);
    let protocol = existingProtocol.get(id);
    if (!protocol) {
      const year = created.getUTCFullYear();
      const seq = (perYear.get(year) ?? 100_000) + 1;
      perYear.set(year, seq);
      protocol = `SOC-${year}/${String(seq).padStart(6, "0")}`;
    }
    reports.push({
      _ext: ext,
      id,
      protocol,
      source,
      status,
      channel: m.channel,
      score: m.score ?? (phishing ? 70 : 15),
      flag: m.flag ?? (phishing ? "red" : "green"),
      message_id: m.id,
      campaign_id: m.campaign_id,
      reporter_id: source === "business" ? null : reporter.id,
      reporter_org_id: source === "business" ? a.bankOrgId : null,
      consent_signal_report: source === "extension",
      assigned_to: status === "received" ? null : a.analystId,
      region_id: region ? regionId.get(region)! : null,
      region_source: region ? "synthetic" : null,
      created_at: created.toISOString(),
      updated_at: new Date(Math.min(now, created.getTime() + (status === "received" ? 0 : (2 + rand() * 46) * 3_600_000))).toISOString(),
    });
  }
  for (const part of chunks(reports, 400)) must(await db.from("reports").upsert(part.map((r) => { const { _ext: _omit, ...rest } = r; void _omit; return rest; }), { onConflict: "id" }), "reports");

  // 5. Status history for the inbox timeline.
  const events = reports.filter((r) => r.status !== "received").map((r) => ({
    id: stableId(`activity-event:${r._ext}`),
    report_id: r.id!,
    actor_id: a.analystId,
    kind: "status_change",
    data: { from: "received", to: r.status, note: null },
    created_at: r.updated_at!,
  }));
  for (const part of chunks(events, 500)) must(await db.from("report_events").upsert(part, { onConflict: "id" }), "report events");

  // 6. Citizens' own link/message checks (C1-C3 panels) and their safety score.
  const checkRows: TablesInsert<"checks">[] = [];
  const links: TablesInsert<"user_check_links">[] = [];
  const kinds = ["url", "text", "phone", "qr", "url", "text"] as const;
  const reportsBy = new Map<string, number>();
  for (const r of reports) if (r.reporter_id) reportsBy.set(r.reporter_id, (reportsBy.get(r.reporter_id) ?? 0) + 1);
  const pool = [...savedMsg.values()];
  for (const c of citizens) {
    const n = 3 + Math.floor(rand() * 12);
    for (let i = 0; i < n; i++) {
      const m = pick(pool);
      const id = stableId(`activity-check:${c.id}:${i}`);
      const at = atLocalTime(now - rand() * opts.days * DAY, rand);
      const kind = pick(kinds);
      checkRows.push({ id, input_kind: kind, input_hash: createHash("sha256").update(id).digest("hex"), score: m.score ?? 50, flag: m.flag ?? "grey", campaign_id: m.campaign_id, model_version: "seed", created_at: at.toISOString() });
      links.push({ user_id: c.id, check_id: id, kind, created_at: at.toISOString() });
    }
  }
  for (const part of chunks(checkRows, 500)) must(await db.from("checks").upsert(part, { onConflict: "id" }), "checks");
  for (const part of chunks(links, 500)) must(await db.from("user_check_links").upsert(part, { onConflict: "user_id,check_id" }), "check links");
  const checksBy = new Map<string, number>();
  for (const l of links) checksBy.set(l.user_id, (checksBy.get(l.user_id) ?? 0) + 1);
  for (const part of chunks(citizens, 100)) {
    must(await db.from("profiles").upsert(part.map((c) => ({ id: c.id, safety_score: Math.min(100, Math.min(20, (checksBy.get(c.id) ?? 0) * 2) + Math.min(30, (reportsBy.get(c.id) ?? 0) * 3) + 10) })), { onConflict: "id" }), "safety scores");
  }

  // 7. Campaign lifecycle from the simulated activity.
  const life = new Map<string, { first: number; last: number; n: number }>();
  for (const r of reports) {
    if (!r.campaign_id) continue;
    const t = Date.parse(r.created_at!);
    const l = life.get(r.campaign_id) ?? { first: t, last: t, n: 0 };
    life.set(r.campaign_id, { first: Math.min(l.first, t), last: Math.max(l.last, t), n: l.n + 1 });
  }
  for (const [id, l] of life) {
    const quietDays = (now - l.last) / DAY;
    const status: Enums["campaign_status"] = quietDays < 10 ? (l.n >= 15 ? "confirmed" : "monitoring") : quietDays < 45 ? "takedown_in_progress" : "resolved";
    must(await db.from("campaigns").update({ first_seen: new Date(l.first).toISOString().slice(0, 10), last_seen: new Date(l.last).toISOString().slice(0, 10), message_count: l.n, status }).eq("id", id), "campaign lifecycle");
  }

  // 8. Aggregates for the map.
  // The insert trigger already keeps region_daily_stats current; the full rebuild is a safety net.
  const { data: rebuilt, error: rebuildError } = await db.rpc("rebuild_region_stats");
  if (rebuildError) console.warn(`rebuild_region_stats skipped (${rebuildError.message}); the trigger-maintained aggregates are used.`);

  return {
    citizens: citizens.length,
    reports: reports.length,
    withoutRegion: reports.filter((r) => !r.region_id).length,
    events: events.length,
    checks: checkRows.length,
    municipalCampaigns,
    activeCampaigns: [...life.values()].filter((l) => (now - l.last) / DAY < 10).length,
    from: reports[0]?.created_at?.slice(0, 10),
    to: reports.at(-1)?.created_at?.slice(0, 10),
    statsRebuiltFrom: rebuilt ?? "trigger",
  };
}
