/**
 * SPEC 14: load the hackathon CSVs from data/s04 into the local database.
 * Idempotent (upserts on external_id, code, domain, cert_id; deterministic ids
 * for sample rows). Uses the secret key, so it must never run in the browser.
 * Run: npm run seed  (needs .env.local with the Supabase project keys and DEMO_PASSWORD)
 *
 * Simulated activity (SYNTHETIC): a random sample of messages becomes reports filed by seeded
 * citizens over the last year, each with a synthetic municipality (needs npm run seed:geo first):
 *   SEED_DATA_DIR=/path/to/csvs npm run seed -- --sample 6000 --citizens 200 --days 365
 */
import "./lib/env";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { flagForScore } from "../src/lib/flags";
import { createContext, type ContextData } from "../src/server/detection/context";
import { scoreDomain } from "../src/server/detection/domain-score";
import { analyze } from "../src/server/detection/index";
import { containsPii, maskText } from "../src/server/detection/masks";
import { defang, extractUrls, foldText, hostOf } from "../src/server/detection/normalize";
import { hashInput, sha256 } from "../src/server/hash";
import type { Database, TablesInsert } from "../src/types/database";
import {
  column,
  parseBool,
  parseDate,
  parseIntOrNull,
  readCsv,
  requireDataset,
  splitList,
} from "./lib/csv";
import { requireEnv } from "./lib/env";
import { chunks, must, scriptClient, type ScriptClient } from "./lib/supabase";
import { labelOf, runTraining } from "./train-classifier";
import { parseActivityArgs, planCampaignWindows, planDates, rng, sampleMessages, seedActivity } from "./lib/activity";

type Enums = Database["public"]["Enums"];

const FILES = {
  campaigns: "A_fushatat.csv",
  messages: "A_mesazhet.csv",
  labels: "labels_mesazhet.csv",
  whois: "B_whois.csv",
  ct: "B_ct_log.csv",
};

/** Stable UUID from a string, so sample rows upsert instead of duplicating. */
function stableId(seed: string): string {
  const h = sha256(`mburoja-seed:${seed}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function slugify(s: string): string {
  return foldText(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sectorOf(name: string): TablesInsert<"institutions">["sector"] {
  const f = foldText(name);
  if (/bashki/.test(f)) return "municipality";
  if (/bank/.test(f)) return "bank";
  if (/post/.test(f)) return "postal";
  if (/polic/.test(f)) return "police";
  if (/energji|ujesjell|ose[eh]/.test(f)) return "utility";
  if (/telekom|vodafone|one/.test(f)) return "telecom";
  if (/e-albania|tatim|issh|ministri|agjenci|drejtori/.test(f)) return "government";
  return "other";
}

function domainClass(value: string | undefined): Enums["domain_class"] {
  const v = foldText(value ?? "");
  if (v.includes("typo")) return "typosquat";
  if (v.includes("homo")) return "homoglyph";
  if (v.includes("combo")) return "combosquat";
  if (/legit|ligj|zyrtar|official/.test(v)) return "legitimate";
  return "unknown";
}

function channelOf(value: string | undefined): Enums["msg_channel"] {
  const v = foldText(value ?? "");
  if (/sms/.test(v)) return "sms";
  if (/mail/.test(v)) return "email";
  if (/whatsapp|viber|facebook|instagram|telegram|social|rrjet/.test(v)) return "social";
  if (/qr/.test(v)) return "qr";
  if (/telefon|call|thirrje/.test(v)) return "call";
  if (/web|faqe/.test(v)) return "web";
  return "other";
}

async function upsert<T extends keyof Database["public"]["Tables"]>(
  db: ScriptClient,
  table: T,
  rows: Database["public"]["Tables"][T]["Insert"][],
  onConflict: string,
) {
  for (const part of chunks(rows)) {
    // The generic overloads of supabase-js do not narrow on a table union.
    must(await db.from(table).upsert(part as never, { onConflict }), `upsert ${table}`);
  }
}

async function main() {
  requireDataset(Object.values(FILES));
  const db = scriptClient();
  const demoPassword = requireEnv("DEMO_PASSWORD");
  const activity = parseActivityArgs(process.argv.slice(2));
  const rand = rng(20261120);

  // ---- Read CSVs -----------------------------------------------------------------
  const campRows = readCsv(FILES.campaigns);
  let msgRows = readCsv(FILES.messages);
  const labelRows = readCsv(FILES.labels);
  const whoisRows = readCsv(FILES.whois);
  const ctRows = readCsv(FILES.ct);

  const C = {
    code: column(campRows, FILES.campaigns, ["fushata_id", "id", "kodi"])!,
    tactic: column(campRows, FILES.campaigns, ["taktika", "tactic"])!,
    inst: column(campRows, FILES.campaigns, ["institucioni_imituar", "institucioni"])!,
    start: column(campRows, FILES.campaigns, ["fillimi", "data_fillimit", "first_seen"], false),
    end: column(campRows, FILES.campaigns, ["fundi", "data_fundit", "last_seen"], false),
    count: column(campRows, FILES.campaigns, ["nr_mesazheve", "mesazhe", "message_count"], false),
    domains: column(campRows, FILES.campaigns, ["domenet", "domains", "domenet_defanged"], false),
  };
  const W = {
    domain: column(whoisRows, FILES.whois, ["domeni", "domain", "domeni_defanged"])!,
    registrar: column(whoisRows, FILES.whois, ["regjistruesi", "registrar"], false),
    registered: column(whoisRows, FILES.whois, ["data_regjistrimit", "registered_at"], false),
    age: column(whoisRows, FILES.whois, ["mosha_dite", "age_days"], false),
    ns: column(whoisRows, FILES.whois, ["nameserver", "ns"], false),
    hosting: column(whoisRows, FILES.whois, ["vendi_hostimit", "hosting_country"], false),
    privacy: column(whoisRows, FILES.whois, ["privacy", "privatesia"], false),
    label: column(whoisRows, FILES.whois, ["etiketa", "label", "klasa"], false),
  };
  const T = {
    id: column(ctRows, FILES.ct, ["cert_id", "id", "certifikata_id"])!,
    domain: column(ctRows, FILES.ct, ["domeni", "domain", "cn"], false),
    san: column(ctRows, FILES.ct, ["san", "sans"], false),
    issuer: column(ctRows, FILES.ct, ["leshuesi", "issuer"], false),
    notBefore: column(ctRows, FILES.ct, ["not_before", "nga", "data_leshimit", "leshuar_me"], false),
    notAfter: column(ctRows, FILES.ct, ["not_after", "deri", "skadon"], false),
    label: column(ctRows, FILES.ct, ["etiketa", "label"], false),
    imitated: column(ctRows, FILES.ct, ["domeni_i_imituar", "imitated_domain"], false),
    campaign: column(ctRows, FILES.ct, ["fushata_id", "campaign_id"], false),
  };
  const M = {
    id: column(msgRows, FILES.messages, ["mesazh_id", "id"])!,
    text: column(msgRows, FILES.messages, ["teksti_defanged", "teksti", "text"])!,
    channel: column(msgRows, FILES.messages, ["kanali", "channel"], false),
    lang: column(msgRows, FILES.messages, ["gjuha", "language"], false),
    sender: column(msgRows, FILES.messages, ["derguesi", "dërguesi", "sender"], false),
    subject: column(msgRows, FILES.messages, ["subjekti", "subject"], false),
    campaign: column(msgRows, FILES.messages, ["fushata_id", "campaign_id"], false),
    date: column(msgRows, FILES.messages, ["data", "data_marrjes", "received_at"], false),
    template: column(msgRows, FILES.messages, ["shablloni_id", "template_id"], false),
  };
  const L = {
    id: column(labelRows, FILES.labels, ["mesazh_id", "id"])!,
    label: column(labelRows, FILES.labels, ["etiketa", "label"])!,
  };

  // ---- 0. Sample mode: a random subset of messages with dates spread over the last year ----
  const allMsgRows = msgRows;
  let activityDates: Map<string, Date> | null = null;
  if (activity.sample > 0) {
    const labels = new Map(labelRows.map((r) => [r[L.id], labelOf(r[L.label])]));
    msgRows = sampleMessages(allMsgRows, M.id, labels, activity.sample, rand);
    const windows = planCampaignWindows(campRows, C.code, C.start, C.end, activity.days, rand);
    activityDates = planDates(msgRows, M.id, M.campaign, windows, activity.days, rand);
    console.log(`Sample mode (SYNTHETIC activity): ${msgRows.length} of ${allMsgRows.length} messages, ${activity.citizens} citizens, last ${activity.days} days.`);
  }

  // ---- 1. Institutions, official domains and channels ----------------------------
  const instNames = [...new Set(campRows.map((r) => r[C.inst]?.trim()).filter(Boolean))];
  const institutions = instNames.map((name) => ({ id: stableId(`inst:${name}`), slug: slugify(name), name, sector: sectorOf(name) }));
  // No explicit id: institutions created earlier (e.g. by seed:geo) keep theirs, so references stay valid.
  await upsert(db, "institutions", institutions.map(({ id: _id, ...rest }) => (void _id, rest)), "slug");
  const instBySlug = new Map(
    must(await db.from("institutions").select("id, slug, name"), "institutions").map((i) => [i.slug, i]),
  );
  const instIdByName = (name: string | undefined) => (name ? instBySlug.get(slugify(name))?.id ?? null : null);

  const officialDomains = institutions.map((i) => ({
    institution_id: instBySlug.get(i.slug)!.id,
    domain: `${i.slug}.al.example`,
  }));
  await upsert(db, "official_domains", officialDomains, "domain");
  const officialChannels = institutions.map((i) => ({
    institution_id: instBySlug.get(i.slug)!.id,
    kind: "sms_sender",
    value: i.name.replace(/[^A-Za-z0-9-]/g, "").slice(0, 11),
  }));
  await upsert(db, "official_channels", officialChannels, "kind,value");

  const ctxData: ContextData = {
    institutions: [...instBySlug.values()].map((i) => ({ id: i.id, name: i.name, aliases: [i.slug] })),
    officialDomains: officialDomains.map((d) => ({ domain: d.domain, institutionId: d.institution_id })),
    officialChannels: officialChannels.map((c) => ({ kind: "sms_sender" as const, value: c.value, institutionId: c.institution_id })),
  };
  const ctx = createContext(ctxData);

  // ---- 2. Campaigns --------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  const byCount = [...campRows].sort((a, b) => (parseIntOrNull(b[C.count ?? ""]) ?? 0) - (parseIntOrNull(a[C.count ?? ""]) ?? 0));
  const publicCodes = new Set(byCount.slice(0, 8).map((r) => r[C.code]));
  const campaigns: TablesInsert<"campaigns">[] = campRows.map((r) => {
    const code = r[C.code].trim();
    const last = C.end ? parseDate(r[C.end]) : null;
    const count = C.count ? parseIntOrNull(r[C.count]) ?? 0 : 0;
    const ended = !!last && last < today;
    const isPublic = publicCodes.has(code);
    return {
      code,
      tactic: r[C.tactic]?.trim() || "unknown",
      institution_id: instIdByName(r[C.inst]),
      imitated_name: r[C.inst]?.trim() || null,
      first_seen: C.start ? parseDate(r[C.start]) : null,
      last_seen: last,
      message_count: count,
      status: ended ? "resolved" : isPublic ? "confirmed" : "monitoring",
      severity: count >= 150 ? "critical" : count >= 75 ? "high" : count >= 25 ? "medium" : "low",
      is_public: isPublic,
      source: "dataset",
    };
  });
  await upsert(db, "campaigns", campaigns, "code");
  const campByCode = new Map(must(await db.from("campaigns").select("id, code, status, institution_id"), "campaigns").map((c) => [c.code, c]));

  // ---- 3. Domains + campaign_domains ---------------------------------------------
  const domainRows: TablesInsert<"domains">[] = [];
  const seenDomain = new Set<string>();
  const addDomain = (d: TablesInsert<"domains">) => {
    if (seenDomain.has(d.domain)) return;
    seenDomain.add(d.domain);
    domainRows.push(d);
  };
  for (const r of whoisRows) {
    const host = hostOf(r[W.domain]);
    if (!host) continue;
    const finding = scoreDomain(host, ctx);
    const cls = W.label ? domainClass(r[W.label]) : "unknown";
    addDomain({
      domain: host,
      class: cls !== "unknown" ? cls : finding.lookalike?.cls === "subdomain_trick" ? "combosquat" : finding.lookalike?.cls ?? "unknown",
      imitates_domain: finding.lookalike?.imitates ?? null,
      imitates_institution_id: finding.lookalike?.institutionId ?? null,
      rule: finding.lookalike ? `${finding.lookalike.cls}:${finding.lookalike.imitates}` : null,
      registrar: W.registrar ? r[W.registrar] || null : null,
      registered_at: W.registered ? parseDate(r[W.registered]) : null,
      age_days: W.age ? parseIntOrNull(r[W.age]) : null,
      nameserver: W.ns ? r[W.ns] || null : null,
      hosting_country: W.hosting ? r[W.hosting] || null : null,
      privacy: W.privacy ? parseBool(r[W.privacy]) : null,
      status: cls === "legitimate" ? "allowlisted" : "threat",
    });
  }
  const campaignDomainPairs: { code: string; host: string }[] = [];
  for (const r of campRows) {
    for (const raw of splitList(C.domains ? r[C.domains] : "")) {
      const host = hostOf(raw);
      if (!host) continue;
      campaignDomainPairs.push({ code: r[C.code].trim(), host });
      const finding = scoreDomain(host, ctx);
      addDomain({
        domain: host,
        class: finding.lookalike?.cls === "subdomain_trick" ? "combosquat" : finding.lookalike?.cls ?? "unknown",
        imitates_domain: finding.lookalike?.imitates ?? null,
        imitates_institution_id: finding.lookalike?.institutionId ?? campByCode.get(r[C.code].trim())?.institution_id ?? null,
        status: "threat",
      });
    }
  }
  await upsert(db, "domains", domainRows, "domain");
  const domainIdByHost = new Map<string, string>();
  for (const part of chunks([...seenDomain], 300)) {
    for (const d of must(await db.from("domains").select("id, domain").in("domain", part), "domains")) domainIdByHost.set(d.domain, d.id);
  }
  await upsert(
    db,
    "campaign_domains",
    campaignDomainPairs
      .map((p) => ({ campaign_id: campByCode.get(p.code)?.id, domain_id: domainIdByHost.get(p.host) }))
      .filter((p): p is { campaign_id: string; domain_id: string } => !!p.campaign_id && !!p.domain_id),
    "campaign_id,domain_id",
  );

  // ---- 4. Certificates -----------------------------------------------------------
  const campaignByHost = new Map(campaignDomainPairs.map((p) => [p.host, campByCode.get(p.code)?.id ?? null]));
  const certs: TablesInsert<"certificates">[] = ctRows.map((r) => {
    const san = splitList(T.san ? r[T.san] : "").map((s) => hostOf(s) ?? s);
    const host = (T.domain && hostOf(r[T.domain])) || san[0] || null;
    return {
      cert_id: r[T.id].trim(),
      domain_id: host ? domainIdByHost.get(host) ?? null : null,
      san,
      issuer: T.issuer ? r[T.issuer] || null : null,
      not_before: T.notBefore ? parseDate(r[T.notBefore]) : null,
      not_after: T.notAfter ? parseDate(r[T.notAfter]) : null,
      label: T.label ? domainClass(r[T.label]) : null,
      imitated_domain: T.imitated ? hostOf(r[T.imitated]) ?? (r[T.imitated] || null) : null,
      campaign_id: (T.campaign && campByCode.get(r[T.campaign])?.id) || (host ? campaignByHost.get(host) ?? null : null),
    };
  });
  await upsert(db, "certificates", certs, "cert_id");

  // ---- 5. Messages (masked, defanged) --------------------------------------------
  const labelById = new Map(labelRows.map((r) => [r[L.id], labelOf(r[L.label])]));
  const scanCtx = createContext({
    ...ctxData,
    domainIntel: domainRows.map((d) => ({
      domain: d.domain,
      ageDays: d.age_days,
      registrar: d.registrar,
      hostingCountry: d.hosting_country,
      privacy: d.privacy,
    })),
  });
  const messages: TablesInsert<"messages">[] = [];
  for (const r of msgRows) {
    const label = labelById.get(r[M.id]);
    const code = M.campaign ? r[M.campaign]?.trim() : "";
    const camp = code ? campByCode.get(code) : undefined;
    const body = maskText(r[M.text] ?? "");
    const channel = channelOf(M.channel ? r[M.channel] : undefined);
    const lang = M.lang && /^en/i.test(r[M.lang] ?? "") ? "en" : "sq";
    const sender = M.sender ? r[M.sender] || undefined : undefined;
    const result = await analyze({ kind: "text", channel, locale: lang, text: body, sender }, scanCtx, {});
    messages.push({
      external_id: r[M.id],
      channel,
      language: lang,
      sender_masked: sender ? maskText(sender) : null,
      subject: M.subject ? maskText(r[M.subject] ?? "") || null : null,
      body_masked: body,
      body_hash: sha256(foldText(body)),
      urls: extractUrls(body).map(defang),
      label: label === 1 ? "phishing" : label === 0 ? "legitimate" : "unknown",
      score: result.score,
      flag: result.flag === "grey" ? null : result.flag,
      campaign_id: camp?.id ?? null,
      institution_id: camp?.institution_id ?? result.matchedInstitution?.id ?? null,
      tactic: code ? campRows.find((c) => c[C.code] === code)?.[C.tactic] ?? null : null,
      template_id: M.template ? r[M.template] || null : null,
      received_at: activityDates?.get(r[M.id])
        ? new Date(activityDates.get(r[M.id])!.getTime() - Math.floor(rand() * 6 * 3_600_000)).toISOString()
        : M.date ? (parseDate(r[M.date]) ? new Date(r[M.date]).toISOString() : null) : null,
      source: "dataset",
    });
  }
  await upsert(db, "messages", messages, "external_id");

  // ---- 6. IoCs ---------------------------------------------------------------------
  const iocs = new Map<string, TablesInsert<"iocs">>();
  for (const p of campaignDomainPairs) {
    iocs.set(`domain:${p.host}`, { type: "domain", value: defang(p.host), campaign_id: campByCode.get(p.code)?.id ?? null, source: "dataset" });
  }
  for (const m of messages) {
    if (m.label !== "phishing") continue;
    for (const u of m.urls ?? []) {
      const host = hostOf(u);
      if (host && host === u.replace(/\[\.\]/g, ".").toLowerCase()) continue;
      iocs.set(`url:${u}`, { type: "url", value: u, campaign_id: m.campaign_id ?? null, source: "dataset" });
    }
  }
  await upsert(db, "iocs", [...iocs.values()], "type,value");

  // ---- 7. Known hashes ---------------------------------------------------------------
  const hashes = new Map<string, TablesInsert<"known_hashes">>();
  for (const i of iocs.values()) {
    const value = i.value.replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http");
    const kind = i.type === "domain" ? "domain" : "url";
    const host = kind === "domain" ? hostOf(value) : null;
    const hash = hashInput(kind, host ?? value);
    hashes.set(hash, { hash, kind, flag: "darkred", campaign_id: i.campaign_id ?? null });
  }
  await upsert(db, "known_hashes", [...hashes.values()], "hash");

  // ---- 8. Templates and recipients -------------------------------------------------
  const tplDir = path.join(process.cwd(), "src", "server", "takedown", "templates");
  const templates: TablesInsert<"templates">[] = [];
  for (const kind of ["registrar", "hosting", "akcesk"] as const) {
    for (const locale of ["sq", "en"] as const) {
      const file = path.join(tplDir, `${kind}.${locale}.md`);
      if (!existsSync(file)) continue;
      const src = readFileSync(file, "utf8");
      const subject = src.match(/^subject:\s*(.+)$/m)?.[1]?.trim() ?? `${kind} {{protocol}}`;
      templates.push({ kind, locale, version: 1, subject, body: src.replace(/^---[\s\S]*?---\n/, "").trim() });
    }
  }
  if (templates.length) await upsert(db, "templates", templates, "kind,locale,version");
  else console.warn("No takedown templates yet (phase 4); skipped templates.");

  const recipients: TablesInsert<"recipients">[] = [
    ...[1, 2, 3].map((n) => ({ id: stableId(`rcp:registrar:${n}`), kind: "registrar" as const, name: `Regjistruesi Shembull ${n}`, abuse_email: `abuse@registrar${n}.example`, match_pattern: `Registrar ${n}`, sla_hours: 24 })),
    ...[1, 2, 3].map((n) => ({ id: stableId(`rcp:hosting:${n}`), kind: "hosting" as const, name: `Hosting Shembull ${n}`, abuse_email: `abuse@hosting${n}.example`, match_pattern: `Hosting ${n}`, sla_hours: 24 })),
    ...[1, 2, 3].map((n) => ({ id: stableId(`rcp:akcesk:${n}`), kind: "akcesk" as const, name: n === 1 ? "AKCESK (demo)" : `Autoritet Kombëtar Demo ${n}`, abuse_email: `incident${n}@cert.example`, match_pattern: null, sla_hours: 24 })),
  ];
  await upsert(db, "recipients", recipients, "id");

  // ---- 9. Demo users and the demo bank organization --------------------------------
  const demoUsers: { email: string; name: string; role: Enums["app_platform_role"] }[] = [
    { email: "citizen@demo.example", name: "Qytetar Demo", role: "user" },
    { email: "analyst@demo.example", name: "Analist Demo", role: "soc_analyst" },
    { email: "lead@demo.example", name: "Drejtues Demo", role: "soc_lead" },
    { email: "admin@demo.example", name: "Admin Demo", role: "platform_admin" },
    { email: "owner@demo-bank.example", name: "Pronar Banka Demo", role: "user" },
  ];
  const existing = must(await db.auth.admin.listUsers({ perPage: 1000 }), "listUsers").users;
  const userIds: Record<string, string> = {};
  for (const u of demoUsers) {
    let id = existing.find((e) => e.email === u.email)?.id;
    if (!id) {
      const created = must(
        await db.auth.admin.createUser({ email: u.email, password: demoPassword, email_confirm: true, user_metadata: { full_name: u.name } }),
        `createUser ${u.email}`,
      );
      id = created.user.id;
    }
    userIds[u.email] = id;
    must(await db.from("profiles").update({ platform_role: u.role, full_name: u.name }).eq("id", id), `profile ${u.email}`);
  }

  const bankInst = [...instBySlug.values()].find((i) => /bank/.test(i.slug));
  const bankOrgId = stableId("org:demo-bank");
  await upsert(db, "organizations", [{ id: bankOrgId, type: "business", name: "Banka Demo", slug: "banka-demo" }], "id");
  await upsert(db, "organization_members", [{ org_id: bankOrgId, user_id: userIds["owner@demo-bank.example"], role: "owner" }], "org_id,user_id");
  if (bankInst) {
    must(await db.from("institutions").update({ organization_id: bankOrgId }).eq("id", bankInst.id), "link bank institution");
    const bankDomain = officialDomains.find((d) => d.institution_id === bankInst.id)?.domain;
    if (bankDomain) {
      await upsert(db, "brand_assets", [{ org_id: bankOrgId, kind: "domain", value: bankDomain, verified_at: new Date().toISOString() }], "org_id,kind,value");
    }
  }

  // ---- 10. Sample reports, notices, advisories --------------------------------------
  const phishing = messages.filter((m) => m.label === "phishing");
  const sources: Enums["report_source"][] = ["citizen_check", "citizen_report", "extension", "business", "citizen_report"];
  const statuses: Enums["report_status"][] = ["received", "received", "under_review", "confirmed", "not_scam", "takedown_requested"];
  const savedMessages = new Map<string, string>();
  for (const part of chunks(phishing.slice(0, 30).map((m) => m.external_id!), 100)) {
    for (const m of must(await db.from("messages").select("id, external_id").in("external_id", part), "messages")) {
      savedMessages.set(m.external_id!, m.id);
    }
  }
  const reports: TablesInsert<"reports">[] = phishing.slice(0, 30).map((m, i) => {
    const source = sources[i % sources.length];
    const score = m.score ?? 60;
    return {
      id: stableId(`report:${i}`),
      source,
      status: statuses[i % statuses.length],
      channel: m.channel,
      score,
      flag: m.flag ?? flagForScore(score),
      message_id: savedMessages.get(m.external_id!) ?? null,
      campaign_id: m.campaign_id ?? null,
      reporter_id: source === "citizen_report" && i % 2 === 0 ? userIds["citizen@demo.example"] : null,
      reporter_org_id: source === "business" ? bankOrgId : null,
      consent_signal_report: source === "extension",
      created_at: new Date(Date.now() - ((i * 11) % 14) * 86_400_000 - i * 3_600_000).toISOString(),
    };
  });
  if (activity.sample === 0) await upsert(db, "reports", reports, "id");

  const confirmed = [...campByCode.values()].filter((c) => c.status === "confirmed").slice(0, 3);
  const analyst = userIds["analyst@demo.example"];
  const notices: TablesInsert<"takedown_notices">[] = confirmed.map((c, i) => {
    const kind = (["registrar", "hosting", "akcesk"] as const)[i % 3];
    return {
      id: stableId(`notice:${c.code}`),
      campaign_id: c.id,
      kind,
      recipient_id: recipients.find((r) => r.kind === kind)!.id!,
      status: "draft",
      subject: `[${c.code}] Kërkesë për bllokim / Takedown request`,
      body: `Draft notice for campaign ${c.code}. Final text is generated from templates in phase 4.`,
      created_by: analyst,
    };
  });
  if (notices.length) await upsert(db, "takedown_notices", notices, "id");

  const advisoryCampaigns = [...campByCode.values()].filter((c) => c.status !== "monitoring").slice(0, 2);
  await upsert(
    db,
    "advisories",
    advisoryCampaigns.map((c, i) => ({
      id: stableId(`advisory:${c.code}`),
      slug: `kujdes-${c.code.toLowerCase()}`,
      title_sq: `Kujdes nga mesazhet e rreme (${c.code})`,
      title_en: `Beware of fake messages (${c.code})`,
      body_sq: "Mos klikoni lidhjet në këto mesazhe. Kontrolloni çdo lidhje në Mburoja dhe raportoni mesazhin.",
      body_en: "Do not click links in these messages. Check any link on Mburoja and report the message.",
      campaign_id: c.id,
      status: i === 0 ? "published" : "draft",
      published_at: i === 0 ? new Date().toISOString() : null,
      created_by: analyst,
      approved_by: i === 0 ? userIds["lead@demo.example"] : null,
    })),
    "id",
  );

  // ---- 11. Storage buckets (also in seed.sql) ---------------------------------------
  for (const id of ["evidence", "brand-assets", "exports"]) {
    const { error } = await db.storage.createBucket(id, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`bucket ${id}: ${error.message}`);
  }

  // ---- 12. Classifier --------------------------------------------------------------
  await runTraining({ record: true });

  // ---- 13. Simulated activity (sample mode) ------------------------------------------
  if (activity.sample > 0 && activityDates) {
    const summary = await seedActivity({
      db, opts: activity, demoPassword, campRows, allMsgRows, sampled: msgRows, dates: activityDates, rand,
      cols: { msgId: M.id, msgCamp: M.campaign, msgText: M.text, msgSender: M.sender, msgSubject: M.subject, campCode: C.code, campInst: C.inst },
      analystId: userIds["analyst@demo.example"],
      bankOrgId,
    });
    console.log("\n⚠ SYNTHETIC activity seeded:");
    console.table(summary);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    try {
      const res = await fetch(`${appUrl}/api/cron/compute-geo-hotspots`, { headers: { Authorization: `Bearer ${requireEnv("CRON_SECRET")}` }, signal: AbortSignal.timeout(90_000) });
      console.log(`compute-geo-hotspots: HTTP ${res.status}`);
    } catch {
      console.log("Hot zones not computed yet: start the app (npm run dev) and run  npm run cron:run compute-geo-hotspots");
    }
  }

  // ---- Validation ------------------------------------------------------------------
  // Narrowed for the type checker (a union of every table name exceeds its instantiation depth).
  const count = async (table: keyof Database["public"]["Tables"]) =>
    (await db.from(table as "reports").select("*", { count: "exact", head: true })).count ?? 0;

  const allBodies: string[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("messages").select("body_masked").range(from, from + 999), "messages");
    allBodies.push(...page.map((m) => m.body_masked));
    if (page.length < 1000) break;
  }
  const piiLeaks = allBodies.filter(containsPii).length;
  const orphanPhishing = messages.filter((m) => m.label === "phishing" && !m.campaign_id).length;

  const checks = [
    { check: "campaigns = A_fushatat rows", expected: campRows.length, actual: await count("campaigns"), ok: (await count("campaigns")) >= campRows.length },
    { check: activity.sample ? "messages >= sample" : "messages = A_mesazhet rows", expected: msgRows.length, actual: await count("messages"), ok: activity.sample ? (await count("messages")) >= msgRows.length : (await count("messages")) === msgRows.length },
    { check: "certificates = B_ct_log rows", expected: ctRows.length, actual: await count("certificates"), ok: (await count("certificates")) === ctRows.length },
    { check: "domains >= B_whois rows", expected: whoisRows.length, actual: await count("domains"), ok: (await count("domains")) >= whoisRows.length },
    { check: "phishing messages without campaign", expected: 0, actual: orphanPhishing, ok: orphanPhishing === 0 },
    { check: "message bodies with PII patterns", expected: 0, actual: piiLeaks, ok: piiLeaks === 0 },
  ];
  console.table(checks);
  if (checks.some((c) => !c.ok)) {
    console.error("Seed validation failed.");
    process.exit(1);
  }
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
