/**
 * Demo campaigns for the SOC campaigns panel (SYNTHETIC data only: domains end in .example).
 *
 * Adds 12 campaigns (codes C-2026-9001 … 9012) that fill the gaps of the CSV dataset so every
 * part of the panel has something to show: all four statuses and severities, owners, recent
 * spikes and fading campaigns, reports across flags/channels/sources, classified checks with
 * matched signals, and lookalike domains with IoCs.
 *
 * Idempotent: every row has a deterministic id, so re-running refreshes the rows (and moves
 * their dates relative to today) instead of duplicating them.
 *
 *   npm run seed:campaigns            # add or refresh
 *   npm run seed:campaigns -- --remove   # delete everything this script created
 */
import "./lib/env";
import { createHash } from "node:crypto";
import { flagForScore } from "../src/lib/flags";
import type { Database, TablesInsert } from "../src/types/database";
import { rng } from "./lib/activity";
import { chunks, must, scriptClient } from "./lib/supabase";

type E = Database["public"]["Enums"];
type ScamType = "fake_institution_login" | "parcel_postal_fee" | "fine_or_tax_refund" | "fake_bank" | "fake_app" | "other";
type Brand = "e_albania" | "tax" | "postal" | "municipality" | "bank" | "police" | "utility" | "telecom" | "other";
/** How report volume is spread over the campaign's lifetime. */
type Shape = "spike" | "growing" | "steady" | "emerging" | "fading" | "trickle";

const db = scriptClient();
const DAY = 86_400_000;
const NOW = Date.now();
const stableId = (seed: string) => {
  const h = createHash("sha256").update(`mburoja-demo-campaigns:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const defang = (s: string) => s.replace(/^http/i, "hxxp").replace(/\./g, "[.]");

interface Demo {
  code: string;
  institution: string;
  tactic: string;
  status: E["campaign_status"];
  severity: E["severity"];
  owner: "lead" | "analyst" | "lead2" | "admin" | null;
  shape: Shape;
  /** Campaign lifetime: started this many days ago, last seen this many days ago. */
  startDays: number;
  endDays: number;
  messages: number;
  isPublic: boolean;
  channels: E["msg_channel"][];
  scamType: ScamType;
  brand: Brand;
  hosting: string;
  place: string | null;
  domains: { domain: string; cls: E["domain_class"]; registrar: string; age: number; imitates: string }[];
  path: string;
  summary: string;
  template: (n: { url: string; ref: string; amount: string; place: string }) => string;
  sender: string;
}

const DEMOS: Demo[] = [
  {
    code: "C-2026-9001", institution: "Posta Shqiptare", tactic: "pako_e_bllokuar", status: "confirmed", severity: "critical", owner: "lead",
    shape: "spike", startDays: 12, endDays: 0, messages: 64, isPublic: true, channels: ["sms", "sms", "sms", "email", "qr"],
    scamType: "parcel_postal_fee", brand: "postal", hosting: "NL", place: null, path: "/dergesa/paguaj",
    domains: [
      { domain: "posta-dergesa-al.example", cls: "combosquat", registrar: "QuickNames Shembull LLC", age: 9, imitates: "postashqiptare.al.example" },
      { domain: "p0sta-shqiptare.example", cls: "homoglyph", registrar: "Domeni Ekspres (fiktiv)", age: 6, imitates: "postashqiptare.al.example" },
    ],
    summary: "Valë SMS-sh që pretendojnë se një pako është bllokuar në doganë dhe kërkojnë një tarifë të vogël. Faqja mbledh të dhënat e kartës.",
    template: ({ url, ref, amount }) => `Posta Shqiptare: Pakoja juaj ${ref} është mbajtur në depo për tarifë doganore të papaguar (${amount} ALL). Paguani sot që të mos kthehet: ${url}`,
    sender: "PostaAL",
  },
  {
    code: "C-2026-9002", institution: "Banka Shembull", tactic: "verifikim_bankar", status: "confirmed", severity: "high", owner: "analyst",
    shape: "growing", startDays: 40, endDays: 1, messages: 46, isPublic: true, channels: ["sms", "email", "email", "call"],
    scamType: "fake_bank", brand: "bank", hosting: "RU", place: null, path: "/verifiko",
    domains: [
      { domain: "bankashembull-verifikim.example", cls: "combosquat", registrar: "Regjistri Lindor (fiktiv)", age: 21, imitates: "bankashembull.al.example" },
    ],
    summary: "Mesazhe që paralajmërojnë bllokimin e llogarisë dhe dërgojnë te një faqe e rreme hyrjeje që kërkon PIN-in dhe kodin OTP.",
    template: ({ url, ref }) => `Banka Shembull: Llogaria juaj do të pezullohet për arsye sigurie (rasti ${ref}). Verifikoni identitetin brenda 24 orëve: ${url}`,
    sender: "BankaSh",
  },
  {
    code: "C-2026-9003", institution: "e-Albania", tactic: "perditesim_llogarie_e-albania", status: "confirmed", severity: "critical", owner: "lead2",
    shape: "spike", startDays: 20, endDays: 2, messages: 40, isPublic: false, channels: ["email", "email", "sms", "social"],
    scamType: "fake_institution_login", brand: "e_albania", hosting: "US", place: null, path: "/hyrje",
    domains: [
      { domain: "e-albania-perditesim.example", cls: "combosquat", registrar: "QuickNames Shembull LLC", age: 14, imitates: "e-albania.al.example" },
      { domain: "e-aibania.example", cls: "homoglyph", registrar: "Domeni Ekspres (fiktiv)", age: 11, imitates: "e-albania.al.example" },
    ],
    summary: "Email-e që kërkojnë 'përditësimin e llogarisë e-Albania' para afatit. Faqja kopjon hyrjen zyrtare dhe vjedh fjalëkalimet.",
    template: ({ url, ref }) => `I nderuar qytetar [NAME], llogaria juaj e-Albania (${ref}) duhet përditësuar deri sot në ora 23:59, përndryshe shërbimet do të çaktivizohen. Hyni këtu: ${url}`,
    sender: "e-Albania <[EMAIL]>",
  },
  {
    code: "C-2026-9004", institution: "Drejtoria e Tatimeve", tactic: "rimbursim_tatimor", status: "takedown_in_progress", severity: "high", owner: "admin",
    shape: "steady", startDays: 55, endDays: 3, messages: 32, isPublic: true, channels: ["email", "sms"],
    scamType: "fine_or_tax_refund", brand: "tax", hosting: "DE", place: null, path: "/rimbursim",
    domains: [
      { domain: "tatime-rimbursim.example", cls: "combosquat", registrar: "Regjistri Lindor (fiktiv)", age: 48, imitates: "tatime.gov.al.example" },
    ],
    summary: "Premtim rimbursimi tatimor që kërkon të dhënat bankare. Njoftimi për heqje është dërguar te regjistruesi.",
    template: ({ url, amount }) => `Drejtoria e Tatimeve: Keni një rimbursim prej ${amount} ALL për vitin 2025. Plotësoni të dhënat e llogarisë për ta marrë: ${url}`,
    sender: "Tatimet <[EMAIL]>",
  },
  {
    code: "C-2026-9005", institution: "Policia Rrugore", tactic: "gjobe_trafiku", status: "monitoring", severity: "low", owner: null,
    shape: "emerging", startDays: 5, endDays: 0, messages: 9, isPublic: false, channels: ["sms"],
    scamType: "fine_or_tax_refund", brand: "police", hosting: "AL", place: null, path: "/gjoba",
    domains: [
      { domain: "gjoba-policia.example", cls: "combosquat", registrar: "Domeni Ekspres (fiktiv)", age: 3, imitates: "asp.gov.al.example" },
    ],
    summary: "Grup i ri SMS-sh për 'gjobë trafiku të papaguar'. Ende pak raporte; nën vëzhgim.",
    template: ({ url, ref, amount }) => `Policia Rrugore: Keni një gjobë të papaguar ${ref} prej ${amount} ALL. Shmangni dyfishimin duke paguar këtu: ${url}`,
    sender: "[PHONE]",
  },
  {
    code: "C-2026-9006", institution: "Energji Shembull", tactic: "rimbursim_energjie", status: "monitoring", severity: "low", owner: "analyst",
    shape: "trickle", startDays: 30, endDays: 4, messages: 7, isPublic: false, channels: ["email", "social"],
    scamType: "fine_or_tax_refund", brand: "utility", hosting: "FR", place: null, path: "/kthim",
    domains: [
      { domain: "energji-kthim.example", cls: "combosquat", registrar: "QuickNames Shembull LLC", age: 25, imitates: "energjishembull.al.example" },
    ],
    summary: "Pak mesazhe që premtojnë kthim parash për faturën e energjisë.",
    template: ({ url, amount }) => `Energji Shembull: Keni paguar më shumë në faturën e fundit. Kthimi prej ${amount} ALL ju pret këtu: ${url}`,
    sender: "Energji <[EMAIL]>",
  },
  {
    code: "C-2026-9007", institution: "Telekom Shembull", tactic: "oferte_pune_false", status: "resolved", severity: "medium", owner: "lead",
    shape: "fading", startDays: 84, endDays: 50, messages: 26, isPublic: true, channels: ["social", "sms", "email"],
    scamType: "other", brand: "telecom", hosting: "US", place: null, path: "/aplikim",
    domains: [
      { domain: "telekom-karriera.example", cls: "combosquat", registrar: "Regjistri Lindor (fiktiv)", age: 90, imitates: "telekomshembull.al.example" },
    ],
    summary: "Oferta pune të rreme që kërkonin 'tarifë dosjeje'. Domeni u hoq dhe fushata u mbyll.",
    template: ({ url, amount }) => `Telekom Shembull po punëson! Jeni përzgjedhur për intervistë. Konfirmoni vendin duke paguar tarifën e dosjes (${amount} ALL): ${url}`,
    sender: "[PHONE]",
  },
  {
    code: "C-2026-9008", institution: "ISSH", tactic: "perditesim_pensioni", status: "confirmed", severity: "medium", owner: "analyst",
    shape: "steady", startDays: 35, endDays: 2, messages: 22, isPublic: false, channels: ["sms", "call"],
    scamType: "fake_institution_login", brand: "other", hosting: "TR", place: null, path: "/pensioni",
    domains: [
      { domain: "issh-pensioni.example", cls: "combosquat", registrar: "Domeni Ekspres (fiktiv)", age: 33, imitates: "issh.gov.al.example" },
    ],
    summary: "Pensionistët marrin SMS se pensioni do të pezullohet pa 'përditësim të të dhënave'.",
    template: ({ url, ref }) => `ISSH: Pensioni juaj (${ref}) do të pezullohet nga muaji i ardhshëm. Përditësoni të dhënat këtu: ${url}`,
    sender: "ISSH",
  },
  {
    code: "C-2026-9009", institution: "Bashkia Tiranë", tactic: "gjobe_parkimi_qr", status: "takedown_in_progress", severity: "critical", owner: "lead",
    shape: "spike", startDays: 28, endDays: 14, messages: 42, isPublic: true, channels: ["qr", "qr", "sms"],
    scamType: "fine_or_tax_refund", brand: "municipality", hosting: "NL", place: "Bashkia Tiranë", path: "/parkim",
    domains: [
      { domain: "tirana-parkim-qr.example", cls: "combosquat", registrar: "QuickNames Shembull LLC", age: 27, imitates: "tirana.al.example" },
      { domain: "tlrana-gjoba.example", cls: "homoglyph", registrar: "Regjistri Lindor (fiktiv)", age: 22, imitates: "tirana.al.example" },
    ],
    summary: "Kode QR të ngjitura mbi tabelat e parkimit në Tiranë që dërgojnë te një faqe pagese e rreme.",
    template: ({ url, ref, amount, place }) => `${place}: Leje parkimi e skaduar (${ref}). Paguani ${amount} ALL brenda 2 orëve për të shmangur bllokimin e mjetit: ${url}`,
    sender: "BashkiaTR",
  },
  {
    code: "C-2026-9010", institution: "Gjendja Civile", tactic: "rinovim_id", status: "monitoring", severity: "medium", owner: null,
    shape: "emerging", startDays: 7, endDays: 1, messages: 11, isPublic: false, channels: ["sms", "email"],
    scamType: "fake_institution_login", brand: "other", hosting: "SG", place: null, path: "/rinovim",
    domains: [
      { domain: "rinovim-karte-id.example", cls: "combosquat", registrar: "Domeni Ekspres (fiktiv)", age: 6, imitates: "gjendjacivile.gov.al.example" },
    ],
    summary: "Mesazhe të reja për 'rinovim urgjent të kartës së identitetit'.",
    template: ({ url, ref }) => `Gjendja Civile: Karta juaj e identitetit (${ref}) skadon së shpejti. Rezervoni rinovimin online sot: ${url}`,
    sender: "GjCivile",
  },
  {
    code: "C-2026-9011", institution: "Bashkia Shkodër", tactic: "subvencion", status: "resolved", severity: "low", owner: "lead2",
    shape: "fading", startDays: 80, endDays: 60, messages: 13, isPublic: false, channels: ["social", "sms"],
    scamType: "other", brand: "municipality", hosting: "AL", place: "Bashkia Shkodër", path: "/subvencion",
    domains: [
      { domain: "shkoder-subvencion.example", cls: "combosquat", registrar: "QuickNames Shembull LLC", age: 70, imitates: "bashkiashkoder.gov.al.example" },
    ],
    summary: "Postime në rrjete sociale për 'subvencion familjar' nga bashkia. Mbyllur pas heqjes së faqes.",
    template: ({ url, amount, place }) => `${place} jep subvencion ${amount} ALL për familjet. Aplikoni para mbylljes së listës: ${url}`,
    sender: "[PHONE]",
  },
  {
    code: "C-2026-9012", institution: "Banka", tactic: "verifikim_bankar", status: "monitoring", severity: "high", owner: null,
    shape: "emerging", startDays: 4, endDays: 0, messages: 15, isPublic: false, channels: ["sms", "call"],
    scamType: "fake_bank", brand: "bank", hosting: "RU", place: null, path: "/siguria",
    domains: [
      { domain: "banka-siguria-online.example", cls: "combosquat", registrar: "Regjistri Lindor (fiktiv)", age: 2, imitates: "banka.al.example" },
    ],
    summary: "Grup i ri thirrjesh dhe SMS-sh që imitojnë sigurinë e bankës. Rritje e shpejtë në ditët e fundit.",
    template: ({ url, ref }) => `Banka: U regjistrua një hyrje e dyshimtë (${ref}). Nëse nuk ishit ju, bllokoni kartën menjëherë: ${url}`,
    sender: "[PHONE]",
  },
];

/**
 * Days ago for one message, following the campaign's shape. u ∈ [0,1] runs from the campaign's
 * start to its last sighting; a power curve concentrates volume early (fading) or late (spike).
 */
const SHAPE_EXPONENT: Record<Shape, number> = { spike: 0.3, emerging: 0.45, growing: 0.6, steady: 1, trickle: 1, fading: 2.5 };
function dayFor(shape: Shape, start: number, end: number, r: number): number {
  const u = Math.pow(r, SHAPE_EXPONENT[shape]);
  return end + Math.max(0, start - end) * (1 - u);
}

function reportStatus(c: Demo, r: number): E["report_status"] {
  const pick = (w: [E["report_status"], number][]) => { let a = 0; for (const [s, p] of w) { a += p; if (r < a) return s; } return w[w.length - 1][0]; };
  switch (c.status) {
    case "monitoring": return pick([["received", 0.6], ["under_review", 0.35], ["duplicate", 0.05]]);
    case "confirmed": return pick([["confirmed", 0.55], ["under_review", 0.2], ["received", 0.15], ["duplicate", 0.07], ["not_scam", 0.03]]);
    case "takedown_in_progress": return pick([["takedown_requested", 0.5], ["confirmed", 0.3], ["under_review", 0.1], ["duplicate", 0.1]]);
    case "resolved": return pick([["taken_down", 0.75], ["duplicate", 0.15], ["not_scam", 0.1]]);
  }
}

const SOURCES: [E["report_source"], number][] = [["citizen_report", 0.38], ["citizen_check", 0.24], ["extension", 0.18], ["feed", 0.12], ["business", 0.08]];

async function main() {
  const remove = process.argv.includes("--remove");
  const ids = { campaigns: DEMOS.map((c) => stableId(`campaign:${c.code}`)) };
  const childIds = (prefix: string) => DEMOS.flatMap((c) => Array.from({ length: c.messages }, (_, i) => stableId(`${prefix}:${c.code}:${i}`)));

  if (remove) {
    for (const [table, prefix] of [["checks", "check"], ["reports", "report"], ["messages", "message"]] as const) {
      for (const part of chunks(childIds(prefix), 200)) must(await db.from(table).delete().in("id", part), `delete ${table}`);
    }
    must(await db.from("campaign_notes").delete().in("campaign_id", ids.campaigns), "delete notes");
    must(await db.from("iocs").delete().in("campaign_id", ids.campaigns), "delete iocs");
    must(await db.from("campaigns").delete().in("id", ids.campaigns), "delete campaigns");
    must(await db.from("domains").delete().in("domain", DEMOS.flatMap((c) => c.domains.map((d) => d.domain))), "delete domains");
    console.log(`✓ removed ${DEMOS.length} demo campaigns and their rows`);
    return;
  }

  // Lookups: institutions by name, staff by role, municipalities, a valid features template.
  const inst = new Map((must(await db.from("institutions").select("id, name"), "institutions")).map((i) => [i.name, i.id]));
  const staff = must(await db.from("profiles").select("id, full_name, platform_role").in("platform_role", ["soc_analyst", "soc_lead", "platform_admin"]).order("full_name"), "staff");
  const leads = staff.filter((s) => s.platform_role === "soc_lead");
  const owners = {
    lead: leads[0]?.id ?? null,
    lead2: leads[1]?.id ?? leads[0]?.id ?? null,
    analyst: staff.find((s) => s.platform_role === "soc_analyst")?.id ?? null,
    admin: staff.find((s) => s.platform_role === "platform_admin")?.id ?? null,
  };
  const regions = must(await db.from("regions").select("id").eq("level", "municipality" as never), "regions").map((r) => r.id);
  const tpl = must(await db.from("checks").select("reasons, features").not("scam_type", "is", null).not("features", "is", null).limit(1).maybeSingle(), "template");
  if (!tpl) throw new Error("No classified check to use as a features template. Run npm run seed first.");

  let messages = 0;
  for (const [ci, c] of DEMOS.entries()) {
    const rand = rng(1000 + ci * 7919);
    const campaignId = ids.campaigns[ci];
    const institutionId = inst.get(c.institution) ?? null;
    if (!institutionId) console.warn(`  ! institution "${c.institution}" not found; ${c.code} gets no institution`);
    const ownerId = c.owner ? owners[c.owner] : null;
    const url = `https://${c.domains[0].domain}${c.path}`;

    const msgRows: TablesInsert<"messages">[] = [];
    const reportRows: TablesInsert<"reports">[] = [];
    const checkRows: TablesInsert<"checks">[] = [];
    for (let i = 0; i < c.messages; i++) {
      const daysAgo = dayFor(c.shape, c.startDays, c.endDays, rand());
      // Office-hours bias: most scams arrive 08:00–22:00.
      const at = new Date(NOW - daysAgo * DAY);
      at.setUTCHours(6 + Math.floor(rand() * 15), Math.floor(rand() * 60), Math.floor(rand() * 60));
      if (at.getTime() > NOW) at.setTime(NOW - Math.floor(rand() * 3_600_000));
      const channel = c.channels[Math.floor(rand() * c.channels.length)];
      const domain = c.domains[Math.floor(rand() * c.domains.length)].domain;
      const msgUrl = `https://${domain}${c.path}?id=${Math.floor(rand() * 1e6).toString(36)}`;
      const body = c.template({
        url: defang(msgUrl),
        ref: `${c.tactic.slice(0, 2).toUpperCase()}-${100000 + Math.floor(rand() * 899999)}`,
        amount: String(150 + Math.floor(rand() * 40) * 50),
        place: c.place ?? c.institution,
      });
      // Most reports score high; a tail of yellow/orange keeps the flag mix realistic.
      const score = Math.min(99, Math.max(22, Math.round(c.severity === "low" ? 35 + rand() * 40 : 55 + rand() * 42 - (rand() < 0.15 ? 25 : 0))));
      const flag = flagForScore(score);
      const messageId = stableId(`message:${c.code}:${i}`);
      msgRows.push({
        id: messageId, channel, language: "sq", sender_masked: c.sender, body_masked: body,
        body_hash: createHash("sha256").update(body).digest("hex"), urls: [defang(msgUrl)],
        label: "phishing", score, flag, campaign_id: campaignId, institution_id: institutionId,
        tactic: c.tactic, received_at: at.toISOString(), source: "seed_demo", created_at: at.toISOString(),
      });
      const reportedAt = new Date(Math.min(NOW, at.getTime() + rand() * 6 * 3_600_000)).toISOString();
      const status = reportStatus(c, rand());
      let r = rand(), source: E["report_source"] = "citizen_report";
      for (const [s, p] of SOURCES) { if (r < p) { source = s; break; } r -= p; }
      reportRows.push({
        id: stableId(`report:${c.code}:${i}`), source, status, channel, score, flag, message_id: messageId,
        campaign_id: campaignId, region_id: regions.length ? regions[Math.floor(rand() * regions.length)] : null,
        assigned_to: ownerId && status !== "received" && rand() < 0.7 ? ownerId : null,
        resolution_note: status === "taken_down" ? "Domeni u hoq nga regjistruesi." : null,
        created_at: reportedAt, updated_at: reportedAt,
      });
      // ~45% of messages were also run through the public checker → classified checks.
      if (rand() < 0.45) {
        const features = structuredClone(tpl.features) as Record<string, unknown> & { domain: Record<string, unknown>; infrastructure: Record<string, unknown>; brands: unknown[] };
        features.domain = { ...features.domain, host: domain, tld: "example", official: false, lookalikeClass: c.domains[0].cls, lookalikeTarget: c.domains[0].imitates };
        features.infrastructure = { ...features.infrastructure, hostingCountry: c.hosting, registrar: c.domains[0].registrar };
        features.brands = [{ source: "text", category: c.brand, evidence: c.institution.toLowerCase() }];
        features.claimedPlace = c.place;
        checkRows.push({
          id: stableId(`check:${c.code}:${i}`), input_kind: rand() < 0.4 ? "url" : "text",
          input_hash: createHash("sha256").update(`demo-check:${c.code}:${i}`).digest("hex"),
          score, flag, reasons: tpl.reasons, campaign_id: campaignId, model_version: "lexicon-v0",
          scam_type: c.scamType, impersonated_brand: c.brand, confidence: Math.round((0.6 + rand() * 0.37) * 100) / 100,
          features: features as never, created_at: reportedAt,
        });
      }
    }

    const dates = msgRows.map((m) => m.received_at!).sort();
    must(await db.from("campaigns").upsert({
      id: campaignId, code: c.code, tactic: c.tactic, institution_id: institutionId, imitated_name: c.institution,
      first_seen: dates[0].slice(0, 10), last_seen: dates[dates.length - 1].slice(0, 10), message_count: c.messages,
      status: c.status, severity: c.severity, owner_id: ownerId, summary: c.summary, is_public: c.isPublic, source: "detected",
    }), `campaign ${c.code}`);
    for (const part of chunks(msgRows, 200)) must(await db.from("messages").upsert(part), `messages ${c.code}`);
    for (const part of chunks(reportRows, 200)) must(await db.from("reports").upsert(part), `reports ${c.code}`);
    for (const part of chunks(checkRows, 200)) must(await db.from("checks").upsert(part), `checks ${c.code}`);

    // Lookalike domains, linked to the campaign, plus domain and URL IoCs (stored defanged).
    const domainRows = must(await db.from("domains").upsert(c.domains.map((d) => ({
      domain: d.domain, class: d.cls, imitates_domain: d.imitates, imitates_institution_id: institutionId,
      rule: `${d.cls}: ${d.imitates}`, registered_at: new Date(NOW - d.age * DAY).toISOString().slice(0, 10), age_days: d.age,
      registrar: d.registrar, hosting_country: c.hosting, privacy: true, in_ct_log: true,
      risk_score: c.severity === "critical" ? 95 : c.severity === "high" ? 85 : c.severity === "medium" ? 70 : 55,
      status: c.status === "resolved" ? "taken_down" : c.status === "monitoring" ? "watching" : "threat",
      first_seen_at: new Date(NOW - Math.min(d.age, c.startDays) * DAY).toISOString(),
    })), { onConflict: "domain" }).select("id"), `domains ${c.code}`);
    must(await db.from("campaign_domains").upsert(domainRows.map((d) => ({ campaign_id: campaignId, domain_id: d.id })), { onConflict: "campaign_id,domain_id", ignoreDuplicates: true }), `campaign_domains ${c.code}`);
    must(await db.from("iocs").upsert([
      ...c.domains.map((d) => ({ type: "domain" as const, value: defang(d.domain), campaign_id: campaignId, source: "seed_demo", first_seen: dates[0], last_seen: dates[dates.length - 1] })),
      { type: "url" as const, value: defang(url), campaign_id: campaignId, source: "seed_demo", first_seen: dates[0], last_seen: dates[dates.length - 1] },
    ], { onConflict: "type,value" }), `iocs ${c.code}`);

    if (ownerId && c.status !== "monitoring") {
      must(await db.from("campaign_notes").upsert({
        id: stableId(`note:${c.code}`), campaign_id: campaignId, author_id: ownerId,
        body: c.status === "resolved" ? "Domenet u hoqën. Asnjë raport i ri në 30 ditë; fushata u mbyll." : "Konfirmuar nga raportet e qytetarëve dhe analiza e domenit. Po përgatitet njoftimi për heqje.",
        created_at: new Date(NOW - c.endDays * DAY).toISOString(),
      }), `note ${c.code}`);
    }
    messages += c.messages;
    console.log(`  ${c.code}  ${c.status.padEnd(21)} ${c.severity.padEnd(8)} ${String(c.messages).padStart(3)} reports · ${checkRows.length} checks · ${c.institution}`);
  }
  console.log(`\n✓ ${DEMOS.length} demo campaigns, ${messages} messages and reports (synthetic, .example domains)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
