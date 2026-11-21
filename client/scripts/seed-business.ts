/**
 * Business dashboard demo data (idempotent, secret key, SYNTHETIC).
 *
 *   npm run seed:business      (after npm run seed, seed:takedowns, seed:domains)
 *
 * 1. Registers the dataset's real official domains (bankabeta.al.example, issh.gov.al.example,
 *    postashqiptare.al.example, <city>.gov.al.example…) to their institutions and relinks every
 *    lookalike's imitated institution. (The first seed invented slug.al.example domains instead,
 *    so most lookalikes had no institution and no business could see "its" lookalikes.)
 * 2. Links the demo business "Banka Demo" (owner@demo-bank.example) to the dataset's "Banka"
 *    institution, with verified brand assets for the four demo bank brands.
 * 3. Brand alerts for its lookalike domains and the campaigns that imitate it, with a realistic
 *    triage history (new → acknowledged → escalated → resolved), plus bell notifications.
 * Campaigns against us, Lookalike domains, Customer reports and Customer notices then read the
 * existing campaigns / domains / reports / takedowns through the business RLS policies.
 */
import { createHash } from "node:crypto";
import { chunks, must, scriptClient } from "./lib/supabase";

const DAY = 86_400_000;
const BUSINESS = { slug: "banka-demo", institution: "Banka" };
const BANK_DOMAINS = ["bankabeta.al.example", "bankasigma.al.example", "bankadelta.al.example", "bankagama.al.example"];
const OFFICIAL: Record<string, string> = {
  ...Object.fromEntries(BANK_DOMAINS.map((d) => [d, "Banka"])),
  "e-albania.al.example": "e-Albania",
  "issh.gov.al.example": "ISSH",
  "postashqiptare.al.example": "Posta Shqiptare",
  "asp.gov.al.example": "Policia Rrugore",          // Albanian State Police
  "energjishembull.al.example": "Energji Shembull",
  "tatime.gov.al.example": "Drejtoria e Tatimeve",
  "telekomshembull.al.example": "Telekom Shembull",
  "gjendjecivile.gov.al.example": "Gjendja Civile",
};
const CITY_SLUG: Record<string, string> = { tirana: "tirane" };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const stableId = (seed: string) => { const h = createHash("sha256").update(seed).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const defang = (d: string) => d.replace(/\./g, "[.]");

async function main() {
  const db = scriptClient();
  const rand = rng(20261122);
  const now = Date.now();

  // ---- 1. Real official domains → institutions; relink lookalikes ----------------------------
  const insts = must(await db.from("institutions").select("id, name, slug"), "institutions");
  const byName = new Map(insts.map((i) => [i.name, i.id]));
  const bySlug = new Map(insts.map((i) => [i.slug, i.id]));
  const imitated = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("domains").select("imitates_domain").not("imitates_domain", "is", null).range(from, from + 999), "imitated");
    for (const d of page) imitated.add(d.imitates_domain!);
    if (page.length < 1000) break;
  }
  const officialRows: { domain: string; institution_id: string }[] = [];
  for (const d of imitated) {
    let inst = OFFICIAL[d] ? byName.get(OFFICIAL[d]) : undefined;
    const city = d.match(/^([a-z]+)\.gov\.al\.example$/)?.[1];
    if (!inst && city && !OFFICIAL[d]) inst = bySlug.get(`bashkia-${CITY_SLUG[city] ?? city}`) ?? byName.get("Bashkia");
    if (inst) officialRows.push({ domain: d, institution_id: inst });
  }
  must(await db.from("official_domains").upsert(officialRows, { onConflict: "domain" }), "official domains");
  let relinked = 0;
  for (const o of officialRows) {
    const { count } = await db.from("domains").update({ imitates_institution_id: o.institution_id }, { count: "exact" }).eq("imitates_domain", o.domain);
    relinked += count ?? 0;
  }

  // ---- 2. Link the demo business to the bank -----------------------------------------------
  const org = must(await db.from("organizations").select("id, name").eq("slug", BUSINESS.slug).maybeSingle(), "organization");
  if (!org) throw new Error(`Business "${BUSINESS.slug}" not found: run npm run seed first.`);
  const bankId = byName.get(BUSINESS.institution);
  if (!bankId) throw new Error(`Institution "${BUSINESS.institution}" not found: run npm run seed first.`);
  must(await db.from("institutions").update({ organization_id: org.id }).eq("id", bankId), "link institution");
  const verified = new Date(now - 200 * DAY).toISOString();
  must(await db.from("brand_assets").upsert([
    ...BANK_DOMAINS.map((value) => ({ org_id: org.id, kind: "domain", value, verified_at: verified })),
    { org_id: org.id, kind: "brand_name", value: "Banka", verified_at: verified },
    { org_id: org.id, kind: "sms_sender", value: "BANKA", verified_at: verified },
  ], { onConflict: "org_id,kind,value" }), "brand assets");
  const orgInst = must(await db.from("institutions").select("id").eq("organization_id", org.id), "org institutions").map((i) => i.id);

  // Our own registered variants: the three lowest-risk combosquats become allowlisted.
  const lookalikes: { id: string; domain: string; class: string; risk_score: number | null; status: string; first_seen_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("domains").select("id, domain, class, risk_score, status, first_seen_at").in("imitates_institution_id", orgInst).range(from, from + 999), "lookalikes");
    lookalikes.push(...page);
    if (page.length < 1000) break;
  }
  const own = lookalikes.filter((d) => d.class === "combosquat" && d.status !== "taken_down").sort((a, b) => (a.risk_score ?? 0) - (b.risk_score ?? 0)).slice(0, 3);
  for (const d of own) { must(await db.from("domains").update({ status: "allowlisted" }).eq("id", d.id), "allowlist"); d.status = "allowlisted"; }

  // ---- 3. Brand alerts with a triage history -------------------------------------------------
  must(await db.from("brand_alerts").delete().eq("org_id", org.id), "clear alerts");
  const alerts: Record<string, unknown>[] = [];
  const statusFor = (createdAt: number, resolved: boolean) => {
    const age = (now - createdAt) / DAY, x = rand();
    if (resolved) return "resolved";
    if (age < 7) return x < 0.65 ? "new" : x < 0.9 ? "acknowledged" : "escalated";
    if (age < 30) return x < 0.2 ? "new" : x < 0.6 ? "acknowledged" : x < 0.85 ? "escalated" : "resolved";
    return x < 0.6 ? "resolved" : x < 0.85 ? "acknowledged" : "escalated";
  };
  const recentDomains = lookalikes
    .filter((d) => d.status !== "allowlisted" && d.status !== "dismissed" && Date.parse(d.first_seen_at) > now - 180 * DAY)
    .sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at))
    .slice(0, 70);
  for (const d of recentDomains) {
    const t = Date.parse(d.first_seen_at);
    const risk = d.risk_score ?? 50;
    alerts.push({
      id: stableId(`brand-alert:${org.id}:domain:${d.id}`), org_id: org.id, domain_id: d.id,
      severity: risk >= 80 ? "critical" : risk >= 60 ? "high" : "medium",
      title: `Lookalike domain ${defang(d.domain)} (${d.class})`,
      status: statusFor(t, d.status === "taken_down"),
      created_at: new Date(t).toISOString(),
    });
  }
  const camps = must(await db.from("campaigns").select("id, code, severity, status, first_seen, message_count").in("institution_id", orgInst), "campaigns");
  for (const c of camps) {
    const t = c.first_seen ? Date.parse(`${c.first_seen}T09:00:00Z`) + rand() * DAY : now - rand() * 200 * DAY;
    alerts.push({
      id: stableId(`brand-alert:${org.id}:campaign:${c.id}`), org_id: org.id, campaign_id: c.id,
      severity: c.severity,
      title: `Campaign ${c.code} imitates ${org.name} (${c.message_count ?? 0} messages)`,
      status: c.status === "resolved" ? "resolved" : c.status === "takedown_in_progress" ? "escalated" : statusFor(t, false),
      created_at: new Date(Math.min(t, now)).toISOString(),
    });
  }
  for (const part of chunks(alerts, 300)) must(await db.from("brand_alerts").upsert(part as never, { onConflict: "id" }), "brand alerts");

  // Bell notifications for the members (latest unhandled alerts), replacing earlier seeded ones.
  const members = must(await db.from("organization_members").select("user_id").eq("org_id", org.id), "members");
  const latest = alerts.filter((a) => a.status === "new").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
  for (const m of members) {
    must(await db.from("notifications").delete().eq("user_id", m.user_id).like("href", "/business/%"), "clear notifications");
    must(await db.from("notifications").insert(latest.map((a, i) => ({ id: stableId(`biz-note:${m.user_id}:${i}`), user_id: m.user_id, title: String(a.title), href: "/business/alerts", created_at: String(a.created_at) }))), "notifications");
  }

  // ---- Summary ------------------------------------------------------------------------------
  const { count: reports } = await db.from("reports").select("id, campaigns!inner(institution_id)", { count: "exact", head: true }).in("campaigns.institution_id", orgInst);
  const byStatus = alerts.reduce<Record<string, number>>((m, a) => ({ ...m, [String(a.status)]: (m[String(a.status)] ?? 0) + 1 }), {});
  const domStatus = lookalikes.reduce<Record<string, number>>((m, d) => ({ ...m, [d.status]: (m[d.status] ?? 0) + 1 }), {});
  console.log(`⚠ SYNTHETIC business data for "${org.name}"`);
  console.table({
    "official domains registered": officialRows.length,
    "lookalikes relinked to an institution": relinked,
    "campaigns against us": camps.length,
    "lookalike domains": lookalikes.length,
    "customer reports": reports ?? 0,
    "brand alerts": alerts.length,
    "bell notifications": latest.length * members.length,
  });
  console.table(byStatus);
  console.table(domStatus);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
