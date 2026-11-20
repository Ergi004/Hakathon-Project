/**
 * Citizen Alerts panel demo data (idempotent, secret key, SYNTHETIC).
 *
 *   npm run seed:alerts
 *
 * For every seeded citizen (citizen001…NNN@demo.example and citizen@demo.example), based on that
 * person's own seeded activity:
 *   - institutions they follow, watch items (hashed + masked exactly like the real watchlist),
 *   - badges earned from their checks/reports/extension use,
 *   - notifications in their language: report status updates, campaigns imitating a followed
 *     institution, a scam increase in their area, watchlist matches and new badges.
 * Older alerts are mostly read, recent ones mostly unread. Run after `npm run seed` (and seed:takedowns).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { foldText } from "../src/server/detection/normalize";
import { sha256 } from "../src/server/hash";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunks, must, scriptClient } from "./lib/supabase";

const DAY = 86_400_000;
type Lang = "sq" | "en";
type Badge = "first_check" | "first_report" | "streak_7" | "quiz_master" | "extension_guard";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const stableId = (seed: string) => { const h = createHash("sha256").update(seed).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };

// Same hashing and masking as src/server/watchlist.ts (that module is server-only).
function watchHash(kind: "phone" | "email" | "name", value: string): string {
  const v = kind === "phone" ? value.replace(/[^\d+]/g, "").replace(/^00/, "+").replace(/^0/, "+355") : kind === "email" ? value.trim().toLowerCase() : foldText(value).replace(/\s+/g, " ");
  return sha256(`watch:${kind}:${v}`);
}
function watchLabel(kind: "phone" | "email" | "name", value: string): string {
  const v = value.trim();
  if (kind === "phone") return v.replace(/\d(?=[\d\s]{2})/g, (d, i) => (i < 6 ? d : "*"));
  if (kind === "email") return v.replace(/^(.).*(@.*)$/, "$1***$2");
  return v.split(/\s+/).map((w) => `${w[0]}${"*".repeat(Math.max(1, w.length - 1))}`).join(" ");
}

const ROOT = path.resolve(import.meta.dirname, "..");
const msgs = (l: Lang) => JSON.parse(readFileSync(path.join(ROOT, `messages/${l}.json`), "utf8"));
const BADGE_NAME: Record<Lang, Record<Badge, string>> = {
  sq: msgs("sq").cit?.badges ?? {},
  en: msgs("en").cit?.badges ?? {},
};

const STATUS_TEXT: Record<string, Record<Lang, (p: string, code?: string) => [string, string]>> = {
  confirmed: {
    sq: (p, c) => [`Raportimi ${p} u konfirmua si mashtrim`, c ? `Faleminderit! Analistët e lidhën me fushatën ${c}.` : "Faleminderit! Analistët e konfirmuan."],
    en: (p, c) => [`Report ${p} was confirmed as a scam`, c ? `Thank you! Analysts linked it to campaign ${c}.` : "Thank you! Analysts confirmed it."],
  },
  under_review: {
    sq: (p) => [`Raportimi ${p} po shqyrtohet`, "Një analist po e kontrollon tani."],
    en: (p) => [`Report ${p} is under review`, "An analyst is looking at it now."],
  },
  takedown_requested: {
    sq: (p) => [`Kërkuam heqjen e faqes nga raportimi ${p}`, "Njoftimi u dërgua te regjistruesi dhe hostingu."],
    en: (p) => [`We asked for the site in report ${p} to be taken down`, "The notice went to the registrar and the host."],
  },
  taken_down: {
    sq: (p) => [`Faqja mashtruese nga raportimi ${p} u hoq`, "Domeni u pezullua pas njoftimit tonë. Faleminderit që raportuat."],
    en: (p) => [`The scam site from report ${p} was taken down`, "The domain was suspended after our notice. Thank you for reporting."],
  },
  not_scam: {
    sq: (p) => [`Raportimi ${p}: nuk është mashtrim`, "Mesazhi u kontrollua dhe duket i ligjshëm."],
    en: (p) => [`Report ${p}: not a scam`, "The message was checked and looks legitimate."],
  },
};

async function main() {
  const db = scriptClient();
  // Untyped view for the geo columns/tables (reports.region_id, regions): they exist in the database
  // (geo migration) but not in every branch's generated types.
  const geo = db as unknown as SupabaseClient;
  const rand = rng(20261121);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const now = Date.now();

  // Citizens (seeded accounts only).
  const emails = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) if (u.email && /^citizen(\d{3})?@demo\.example$/.test(u.email)) emails.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  const ids = [...emails.keys()];
  if (!ids.length) throw new Error("No seeded citizens: run npm run seed -- --sample 6000 --citizens 200 first.");
  const profiles = new Map<string, Lang>();
  for (const part of chunks(ids, 200)) for (const p of must(await db.from("profiles").select("id, locale").in("id", part), "profiles")) profiles.set(p.id, p.locale === "en" ? "en" : "sq");

  // Their activity.
  type Rep = { id: string; protocol: string; status: string; created_at: string; updated_at: string; source: string; region_id: string | null; campaign_id: string | null };
  const reportsBy = new Map<string, Rep[]>();
  for (const part of chunks(ids, 100)) {
    for (let from = 0; ; from += 1000) {
      const res = await geo.from("reports").select("id, protocol, status, created_at, updated_at, source, region_id, campaign_id, reporter_id").in("reporter_id", part).range(from, from + 999);
      if (res.error) throw new Error(`reports: ${res.error.message}`);
      const page = res.data as (Rep & { reporter_id: string | null })[];
      for (const r of page) reportsBy.set(r.reporter_id!, [...(reportsBy.get(r.reporter_id!) ?? []), r]);
      if (page.length < 1000) break;
    }
  }
  const checksBy = new Map<string, string[]>();
  for (const part of chunks(ids, 100)) {
    for (const c of must(await db.from("user_check_links").select("user_id, created_at").in("user_id", part), "checks")) checksBy.set(c.user_id, [...(checksBy.get(c.user_id) ?? []), c.created_at]);
  }
  const { data: regionRows } = await geo.from("regions").select("id, name_sq, name_en");
  const regionById = new Map(((regionRows ?? []) as { id: string; name_sq: string; name_en: string | null }[]).map((r) => [r.id, r]));
  const regionName = (id: string, l: Lang) => { const r = regionById.get(id); return r ? (l === "en" ? r.name_en ?? r.name_sq : r.name_sq) : ""; };
  const institutions = must(await db.from("institutions").select("id, name"), "institutions");
  const campaigns = must(await db.from("campaigns").select("id, code, institution_id, imitated_name, status, is_public, last_seen, message_count"), "campaigns");
  const campCode = new Map(campaigns.map((c) => [c.id, c.code]));

  // Followed-institution alerts link to the public threat page, so they need public campaigns.
  let publicCamps = campaigns.filter((c) => c.is_public && ["confirmed", "takedown_in_progress", "resolved"].includes(c.status));
  if (publicCamps.length < 12) {
    const promote = campaigns
      .filter((c) => !c.is_public && ["confirmed", "takedown_in_progress"].includes(c.status))
      .sort((a, b) => (b.message_count ?? 0) - (a.message_count ?? 0))
      .slice(0, 12 - publicCamps.length);
    for (const c of promote) must(await db.from("campaigns").update({ is_public: true }).eq("id", c.id), "publish campaign");
    publicCamps = [...publicCamps, ...promote.map((c) => ({ ...c, is_public: true }))];
    console.log(`Published ${promote.length} more active campaigns to the public threat feed (demo).`);
  }
  const publicByInst = new Map<string, typeof publicCamps>();
  for (const c of publicCamps) if (c.institution_id) publicByInst.set(c.institution_id, [...(publicByInst.get(c.institution_id) ?? []), c]);
  // Recent report protocols (for watchlist matches).
  const recentProtocols = must(await db.from("reports").select("protocol, created_at").gte("created_at", new Date(now - 45 * DAY).toISOString()).limit(1000), "recent reports");

  // Replace previously seeded follows / watch items / badges / notifications for these citizens.
  for (const part of chunks(ids, 100)) {
    must(await db.from("notifications").delete().in("user_id", part), "clear notifications");
    must(await db.from("user_follows").delete().in("user_id", part), "clear follows");
    must(await db.from("user_watch_items").delete().in("user_id", part), "clear watch items");
  }

  const follows: { user_id: string; institution_id: string; created_at: string }[] = [];
  const watch: { id: string; user_id: string; kind: "phone" | "email" | "name"; value_hash: string; label: string; last_match_at: string | null; created_at: string }[] = [];
  const badges: { user_id: string; badge: Badge; awarded_at: string }[] = [];
  const notes: { id: string; user_id: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }[] = [];
  const instWeighted = [...institutions].sort((a, b) => (publicByInst.get(b.id)?.length ?? 0) - (publicByInst.get(a.id)?.length ?? 0));

  for (const uid of ids) {
    const l = profiles.get(uid) ?? "sq";
    const reps = (reportsBy.get(uid) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const checks = (checksBy.get(uid) ?? []).sort();
    const joined = Math.min(...[...reps.map((r) => Date.parse(r.created_at)), ...checks.map((c) => Date.parse(c)), now - 30 * DAY]);
    let n = 0;
    const note = (title: string, body: string | null, href: string | null, at: number) => {
      const t = Math.min(at, now - 60_000);
      const age = (now - t) / DAY;
      const read = age > 7 ? rand() < 0.85 : rand() < 0.3;
      notes.push({ id: stableId(`alert:${uid}:${n++}`), user_id: uid, title, body, href, read_at: read ? new Date(Math.min(now, t + rand() * 2 * DAY)).toISOString() : null, created_at: new Date(t).toISOString() });
    };

    // Follows: institutions they report about most, plus a couple of popular ones.
    const fromReports = new Map<string, number>();
    for (const r of reps) {
      const inst = campaigns.find((c) => c.id === r.campaign_id)?.institution_id;
      if (inst) fromReports.set(inst, (fromReports.get(inst) ?? 0) + 1);
    }
    const followIds = new Set([...fromReports.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k));
    while (followIds.size < 2 + Math.floor(rand() * 3)) followIds.add(pick(instWeighted.slice(0, 8)).id);
    for (const iid of followIds) follows.push({ user_id: uid, institution_id: iid, created_at: new Date(joined + rand() * 20 * DAY).toISOString() });

    // Report status updates (most recent 6 that changed status).
    for (const r of reps.filter((x) => STATUS_TEXT[x.status]).slice(-6)) {
      const [title, body] = STATUS_TEXT[r.status][l](r.protocol, r.campaign_id ? campCode.get(r.campaign_id) : undefined);
      note(title, body, `/citizen/reports/${r.id}`, Date.parse(r.updated_at));
    }

    // Campaigns imitating a followed institution (public threat page).
    for (const iid of followIds) {
      const list = publicByInst.get(iid) ?? [];
      for (const c of list.slice(0, 2)) {
        const name = c.imitated_name ?? institutions.find((i) => i.id === iid)?.name ?? "";
        const at = c.last_seen ? Date.parse(`${c.last_seen}T10:00:00Z`) - rand() * 5 * DAY : now - rand() * 40 * DAY;
        note(
          l === "sq" ? `${name} po imitohet: fushata ${c.code}` : `${name} is being imitated: campaign ${c.code}`,
          l === "sq" ? `${c.message_count ?? 0} raportime deri tani. Mos klikoni lidhjet dhe mos jepni kode.` : `${c.message_count ?? 0} reports so far. Do not click links or share codes.`,
          `/threats/${c.code}`,
          Math.max(at, joined),
        );
      }
    }

    // Area alert: the municipality they report from most.
    const regionCounts = new Map<string, number>();
    for (const r of reps) if (r.region_id) regionCounts.set(r.region_id, (regionCounts.get(r.region_id) ?? 0) + 1);
    const homeId = [...regionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (homeId && regionById.has(homeId) && rand() < 0.6) {
      const name = regionName(homeId, l);
      note(
        l === "sq" ? `Rritje mashtrimesh në zonën tuaj: ${name}` : `Scams rising in your area: ${name}`,
        l === "sq" ? "Këtë javë ka më shumë raportime se zakonisht. Kontrolloni çdo mesazh para se të klikoni." : "More reports than usual this week. Check any message before you click.",
        "/threats",
        now - rand() * 6 * DAY,
      );
    }

    // Watch items (synthetic contacts: 000 blocks, .example domains) and matches.
    const items: { kind: "phone" | "email" | "name"; value: string }[] = [];
    if (rand() < 0.6) items.push({ kind: "phone", value: `+355 6${7 + Math.floor(rand() * 3)} 000 ${String(Math.floor(rand() * 100)).padStart(2, "0")} ${String(Math.floor(rand() * 100)).padStart(2, "0")}` });
    if (rand() < 0.4) items.push({ kind: "email", value: `${pick(["mama", "babi", "gjyshja", "vellai", "motra", "puna"])}${Math.floor(rand() * 90 + 10)}@mail.example` });
    if (rand() < 0.2) items.push({ kind: "name", value: pick(["Drita Hoxha", "Arben Kola", "Mira Leka", "Gezim Basha"]) });
    for (const it of items) {
      const created = joined + rand() * 30 * DAY;
      const matched = rand() < 0.45 && recentProtocols.length;
      const id = stableId(`watch:${uid}:${it.kind}:${it.value}`);
      const label = watchLabel(it.kind, it.value);
      let last: number | null = null;
      if (matched) {
        for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) {
          const r = pick(recentProtocols);
          const at = Math.max(Date.parse(r.created_at), created);
          last = Math.max(last ?? 0, at);
          note(`${label} — ${r.protocol}`, "watch_match", "/citizen/watchlist", at);
        }
      }
      watch.push({ id, user_id: uid, kind: it.kind, value_hash: watchHash(it.kind, it.value), label, last_match_at: last ? new Date(last).toISOString() : null, created_at: new Date(created).toISOString() });
    }

    // Badges earned from real activity, each with a notification.
    const earned: [Badge, number][] = [];
    if (checks.length) earned.push(["first_check", Date.parse(checks[0])]);
    if (reps.length) earned.push(["first_report", Date.parse(reps[0].created_at)]);
    const ext = reps.find((r) => r.source === "extension");
    if (ext) earned.push(["extension_guard", Date.parse(ext.created_at)]);
    if (reps.length >= 25) earned.push(["streak_7", Date.parse(reps[Math.min(reps.length - 1, 20)].created_at)]);
    if (rand() < 0.25) earned.push(["quiz_master", joined + rand() * (now - joined)]);
    for (const [b, at] of earned) {
      badges.push({ user_id: uid, badge: b, awarded_at: new Date(at).toISOString() });
      const name = BADGE_NAME[l][b] ?? b;
      note(l === "sq" ? `Distinktiv i ri: ${name}` : `New badge: ${name}`, null, "/citizen", at);
    }
  }

  for (const part of chunks(follows, 500)) must(await db.from("user_follows").upsert(part, { onConflict: "user_id,institution_id" }), "follows");
  for (const part of chunks(watch, 500)) must(await db.from("user_watch_items").upsert(part, { onConflict: "user_id,kind,value_hash" }), "watch items");
  for (const part of chunks(badges, 500)) must(await db.from("user_badges").upsert(part, { onConflict: "user_id,badge" }), "badges");
  for (const part of chunks(notes, 500)) must(await db.from("notifications").upsert(part, { onConflict: "id" }), "notifications");

  const kinds = { status: 0, imitation: 0, area: 0, watch: 0, badge: 0 };
  for (const x of notes) {
    if (x.body === "watch_match") kinds.watch++;
    else if (x.href?.startsWith("/threats/")) kinds.imitation++;
    else if (x.href === "/threats") kinds.area++;
    else if (x.href?.startsWith("/citizen/reports/")) kinds.status++;
    else kinds.badge++;
  }
  console.log(`⚠ SYNTHETIC citizen alerts for ${ids.length} citizens: ${notes.length} notifications (${notes.filter((x) => !x.read_at).length} unread), ${follows.length} follows, ${watch.length} watch items, ${badges.length} badges`);
  console.table(kinds);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
