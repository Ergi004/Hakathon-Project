/**
 * Domain intelligence demo data (idempotent, secret key, SYNTHETIC dataset).
 *
 *   SEED_DATA_DIR=/path/to/csvs npm run seed:domains
 *
 * Updates the domains loaded by `npm run seed` using the dataset's labels_domenet.csv + B_whois.csv:
 *   - class from the label (Albanian "legjitim" → legitimate: no more false "threats"),
 *   - the human-readable rule, imitated domain and institution, CT-log flag,
 *   - risk_score with the app's own formula (src/server/jobs detectLookalikes):
 *       base homoglyph 70 / typosquat 60 / combosquat 55, +15 young (< 30 days), +10 punycode, +5 WHOIS privacy,
 *   - status: lookalikes threat (risk ≥ 60) or watching, taken_down when their takedown notice succeeded
 *     (and for most domains of resolved campaigns); legitimate ones dismissed,
 *   - first_seen_at spread realistically (first certificate or shortly after registration, last 12 months),
 *   - demo intel scans (mock = true) for recent lookalikes so the "latest intel" column has verdicts.
 */
import { createHash, randomBytes } from "node:crypto";
import { domainToASCII } from "node:url";
import { column, readCsv, requireDataset } from "./lib/csv";
import { chunks, must, scriptClient } from "./lib/supabase";

const DAY = 86_400_000;
type Cls = "typosquat" | "homoglyph" | "combosquat" | "legitimate" | "unknown";
type Verdict = "malicious" | "suspicious" | "clean" | "unknown";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const stableId = (seed: string) => { const h = createHash("sha256").update(seed).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function classOf(label: string | undefined): Cls {
  const v = fold(label ?? "");
  if (v.includes("typo")) return "typosquat";
  if (v.includes("homo")) return "homoglyph";
  if (v.includes("combo")) return "combosquat";
  if (/legit|legj|ligj|zyrtar|official/.test(v)) return "legitimate";
  return "unknown";
}
const BASE: Partial<Record<Cls, number>> = { homoglyph: 70, typosquat: 60, combosquat: 55 };

async function main() {
  requireDataset(["labels_domenet.csv", "B_whois.csv"]);
  const db = scriptClient();
  const rand = rng(20261121);
  const now = Date.now();
  const yearAgo = now - 365 * DAY;

  const labels = readCsv("labels_domenet.csv");
  const whois = readCsv("B_whois.csv");
  const L = {
    domain: column(labels, "labels_domenet.csv", ["domeni", "domain"])!,
    label: column(labels, "labels_domenet.csv", ["etiketa", "label"])!,
    rule: column(labels, "labels_domenet.csv", ["rregulli", "rule"], false),
    imitated: column(labels, "labels_domenet.csv", ["domeni_i_imituar", "imitated_domain"], false),
    ct: column(labels, "labels_domenet.csv", ["ne_ct_log", "in_ct_log"], false),
  };
  const W = {
    domain: column(whois, "B_whois.csv", ["domeni", "domain"])!,
    registered: column(whois, "B_whois.csv", ["data_regjistrimit", "registered_at"], false),
    privacy: column(whois, "B_whois.csv", ["privacy", "privatesia"], false),
  };
  // The database stores hosts in punycode (xn--…); the dataset writes them in Unicode. Index both forms.
  const keys = (d: string) => { const h = d.trim().toLowerCase(); const a = domainToASCII(h); return a && a !== h ? [h, a] : [h]; };
  const labelBy = new Map(labels.flatMap((r) => keys(r[L.domain]).map((k) => [k, r] as const)));
  const whoisBy = new Map(whois.flatMap((r) => keys(r[W.domain]).map((k) => [k, r] as const)));

  // Database state.
  const domains: { id: string; domain: string; registered_at: string | null; privacy: boolean | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("domains").select("id, domain, registered_at, privacy").range(from, from + 999), "domains");
    domains.push(...page);
    if (page.length < 1000) break;
  }
  if (!domains.length) throw new Error("No domains: run npm run seed first.");
  const official = new Map(must(await db.from("official_domains").select("domain, institution_id"), "official domains").map((o) => [o.domain, o.institution_id]));
  const firstCert = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("certificates").select("domain_id, not_before").not("domain_id", "is", null).range(from, from + 999), "certificates");
    for (const c of page) if (c.not_before) { const t = Date.parse(c.not_before); const prev = firstCert.get(c.domain_id!); if (!prev || t < prev) firstCert.set(c.domain_id!, t); }
    if (page.length < 1000) break;
  }
  const takenDown = new Set(must(await db.from("takedown_notices").select("domain_id").eq("status", "taken_down").not("domain_id", "is", null), "notices").map((n) => n.domain_id!));
  const campaignOf = new Map<string, string>();
  for (const cd of must(await db.from("campaign_domains").select("domain_id, campaigns(status)"), "campaign domains")) campaignOf.set(cd.domain_id, (cd.campaigns as { status: string } | null)?.status ?? "");

  type Upd = { id: string; domain: string; class: Cls; rule: string | null; imitates_domain: string | null; imitates_institution_id: string | null; in_ct_log: boolean; risk_score: number; status: string; age_days: number | null; first_seen_at: string };
  const updates: Upd[] = [];
  const stats: Record<string, number> = {};
  for (const d of domains) {
    const host = d.domain.toLowerCase();
    const lab = labelBy.get(host);
    const who = whoisBy.get(host);
    const cls = classOf(lab?.[L.label]);
    const registered = d.registered_at ? Date.parse(d.registered_at) : who && W.registered ? Date.parse(who[W.registered]) : NaN;
    const age = Number.isFinite(registered) ? Math.max(0, Math.floor((now - registered) / DAY)) : null;
    const privacy = d.privacy ?? (who && W.privacy ? /^(1|true|po|yes)$/i.test(who[W.privacy]) : false);
    const lookalike = cls !== "legitimate" && cls !== "unknown";
    const risk = lookalike
      ? Math.min(100, (BASE[cls] ?? 50) + (age !== null && age < 30 ? 15 : 0) + (host.split(".").some((l) => l.startsWith("xn--")) ? 10 : 0) + (privacy ? 5 : 0))
      : cls === "legitimate" ? Math.floor(rand() * 9) : 25 + Math.floor(rand() * 15);

    const campStatus = campaignOf.get(d.id);
    let status: string;
    if (cls === "legitimate") status = "dismissed";
    else if (takenDown.has(d.id)) status = "taken_down";
    else if (campStatus === "resolved" && rand() < 0.75) status = "taken_down";
    else status = risk >= 60 ? "threat" : "watching";

    // First seen: the first certificate, otherwise a few days after registration; within the last year.
    const cert = firstCert.get(d.id);
    let seen = cert ?? (Number.isFinite(registered) ? registered + rand() * 3 * DAY : NaN);
    if (!Number.isFinite(seen) || seen < yearAgo) seen = yearAgo + rand() * (now - yearAgo);
    seen = Math.min(seen, now - rand() * 6 * 3_600_000);

    const imitated = L.imitated ? lab?.[L.imitated]?.trim().toLowerCase() || null : null;
    updates.push({
      id: d.id,
      domain: d.domain,
      class: cls,
      rule: L.rule ? lab?.[L.rule]?.trim() || null : null,
      imitates_domain: lookalike ? imitated : null,
      imitates_institution_id: lookalike && imitated ? official.get(imitated) ?? null : null,
      in_ct_log: L.ct ? /^(1|true|po|yes)$/i.test(lab?.[L.ct] ?? "") || !!cert : !!cert,
      risk_score: risk,
      status,
      age_days: age,
      first_seen_at: new Date(seen).toISOString(),
    });
    stats[status] = (stats[status] ?? 0) + 1;
  }
  for (const part of chunks(updates, 500)) must(await db.from("domains").upsert(part, { onConflict: "id" }), "domains");

  // Demo intel scans (mock) for the 600 most recently seen lookalikes.
  const recent = updates.filter((u) => u.class !== "legitimate" && u.class !== "unknown").sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at)).slice(0, 600);
  const scans: Record<string, unknown>[] = [];
  const subs: Record<string, unknown>[] = [];
  const verdicts: Record<Verdict, number> = { malicious: 0, suspicious: 0, clean: 0, unknown: 0 };
  for (const u of recent) {
    const x = rand();
    const verdict: Verdict = u.status === "taken_down" ? (x < 0.8 ? "malicious" : "suspicious")
      : u.risk_score >= 70 ? (x < 0.55 ? "malicious" : x < 0.9 ? "suspicious" : "unknown")
      : u.risk_score >= 60 ? (x < 0.3 ? "malicious" : x < 0.75 ? "suspicious" : "clean")
      : x < 0.4 ? "suspicious" : x < 0.8 ? "clean" : "unknown";
    verdicts[verdict]++;
    const id = stableId(`domscan:${u.domain}`);
    const at = Date.parse(u.first_seen_at) + (1 + rand() * 20) * 3_600_000;
    scans.push({
      id, token_hash: createHash("sha256").update(randomBytes(16)).digest("hex"),
      url_sanitized: `hxxps://${u.domain.replace(/\./g, "[.]")}/`, host: u.domain, registrable_domain: u.domain,
      tier: "A", status: "done", verdict, score_delta: verdict === "malicious" ? 20 : verdict === "suspicious" ? 8 : 0,
      base_score: u.risk_score, final_score: Math.min(100, u.risk_score + (verdict === "malicious" ? 20 : verdict === "suspicious" ? 8 : 0)),
      domain_age_days: u.age_days, mock: true,
      created_at: new Date(Math.min(at, now)).toISOString(), finished_at: new Date(Math.min(at + 20_000, now)).toISOString(),
    });
    if (verdict === "malicious" && rand() < 0.7) {
      const labelsSub = ["login", "secure", "pagesa", "verifikim", "llogaria", "e-albania", "portal", "auth", "mail", "cdn"];
      const n = 2 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        const sub = `${labelsSub[(i + Math.floor(rand() * labelsSub.length)) % labelsSub.length]}${i ? i : ""}.${u.domain}`;
        subs.push({ id: stableId(`domsub:${u.domain}:${sub}`), scan_id: id, registrable_domain: u.domain, subdomain: sub, source: rand() < 0.7 ? "crtsh" : "virustotal", resolves: rand() < 0.6, first_cert_at: new Date(Date.parse(u.first_seen_at) + rand() * 5 * DAY).toISOString().slice(0, 10), verdict: rand() < 0.5 ? "malicious" : "suspicious", brand_token: /e-albania|pagesa|llogaria|verifikim/.test(sub) });
      }
    }
  }
  for (const part of chunks(scans, 300)) must(await db.from("scans").upsert(part as never, { onConflict: "id" }), "scans");
  for (const part of chunks(subs, 500)) must(await db.from("intel_subdomains").upsert(part as never, { onConflict: "scan_id,subdomain" }), "subdomains");

  const byClass = updates.reduce<Record<string, number>>((m, u) => ({ ...m, [u.class]: (m[u.class] ?? 0) + 1 }), {});
  const risky = updates.filter((u) => u.risk_score >= 60).length;
  console.log(`⚠ SYNTHETIC domain intelligence: ${updates.length} domains updated · ${risky} with risk ≥ 60 · ${scans.length} demo intel scans (mock) · ${subs.length} subdomains`);
  console.table({ ...stats });
  console.table(byClass);
  console.table(verdicts);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
