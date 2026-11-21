/**
 * Takedown tracker demo data (idempotent, secret key, SYNTHETIC; sending is simulated).
 *
 *   npm run seed:takedowns
 *
 * Creates notices for campaigns that have domains, across the whole lifecycle, with the real
 * sq/en templates filled in (same placeholders as the app), a notice_events timeline, and an
 * outbox row for every notice that was "sent". Four-eyes rule: an analyst creates, a different
 * lead approves. Run after `npm run seed` (needs campaigns, domains, recipients, templates).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defang } from "../src/server/detection/normalize";
import { parseTemplateFile, render } from "../src/server/takedown/render";
import type { Database, TablesInsert } from "../src/types/database";
import { chunks, must, scriptClient, type ScriptClient } from "./lib/supabase";

type Enums = Database["public"]["Enums"];
type Kind = Enums["notice_type"];
const H = 3_600_000, DAY = 24 * H;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const stableId = (seed: string) => { const h = createHash("sha256").update(seed).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };

async function template(db: ScriptClient, kind: Kind, locale: "sq" | "en") {
  const { data } = await db.from("templates").select("subject, body").eq("kind", kind).eq("locale", locale).eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
  return data ?? parseTemplateFile(readFileSync(path.join(process.cwd(), "src/server/takedown/templates", `${kind}.${locale}.md`), "utf8"));
}

async function userId(db: ScriptClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function main() {
  const db = scriptClient();
  const rand = rng(20261121);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const now = Date.now();

  const analyst = await userId(db, "analyst@demo.example");
  const leads = [await userId(db, "lead@demo.example"), await userId(db, "soc-lead@demo.example")].filter((x): x is string => !!x);
  if (!analyst || !leads.length) throw new Error("Demo staff missing: run npm run seed first (analyst@ and lead@demo.example).");
  const { data: analystProfile } = await db.from("profiles").select("full_name").eq("id", analyst).single();

  const recipients = must(await db.from("recipients").select("id, kind, name, abuse_email, match_pattern, sla_hours"), "recipients");
  if (!recipients.length) throw new Error("No recipients: run npm run seed first.");
  const tpl = new Map<string, { subject: string; body: string }>();
  for (const k of ["registrar", "hosting", "akcesk"] as const) for (const l of ["sq", "en"] as const) tpl.set(`${k}.${l}`, await template(db, k, l));

  // Campaigns that reached a takedown-worthy state and have at least one domain.
  const camps = must(await db.from("campaigns").select("id, code, imitated_name, first_seen, last_seen, status").in("status", ["confirmed", "takedown_in_progress", "resolved"]).order("last_seen", { ascending: false }), "campaigns");
  const links = must(await db.from("campaign_domains").select("campaign_id, domains(id, domain, registrar, hosting_country)").in("campaign_id", camps.map((c) => c.id)), "campaign domains");
  const domainsOf = new Map<string, { id: string; domain: string; registrar: string | null; hosting_country: string | null }[]>();
  for (const l of links) {
    const d = l.domains as { id: string; domain: string; registrar: string | null; hosting_country: string | null } | null;
    if (d) domainsOf.set(l.campaign_id, [...(domainsOf.get(l.campaign_id) ?? []), d]);
  }
  const reportCount = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("reports").select("campaign_id").not("campaign_id", "is", null).range(from, from + 999), "reports");
    for (const r of page) reportCount.set(r.campaign_id!, (reportCount.get(r.campaign_id!) ?? 0) + 1);
    if (page.length < 1000) break;
  }
  const iocsOf = async (campaignId: string) => must(await db.from("iocs").select("type, value").eq("campaign_id", campaignId).limit(12), "iocs");

  const eligible = camps.filter((c) => domainsOf.get(c.id)?.length).slice(0, 110);
  const notices: TablesInsert<"takedown_notices">[] = [];
  const events: TablesInsert<"notice_events">[] = [];
  const outbox: TablesInsert<"outbox">[] = [];
  // Re-runs keep each notice's protocol (campaign dates can shift between runs); new notices continue
  // after the highest number already used in that year.
  const perYear = new Map<number, number>();
  const existingProtocol = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const page = must(await db.from("takedown_notices").select("id, protocol").range(from, from + 999), "existing notices");
    for (const n of page) {
      existingProtocol.set(n.id, n.protocol);
      const m = n.protocol.match(/^SOC-(\d{4})\/(\d+)$/);
      if (m) perYear.set(Number(m[1]), Math.max(perYear.get(Number(m[1])) ?? 200_000, Number(m[2])));
    }
    if (page.length < 1000) break;
  }
  const ev = (noticeId: string, kind: string, at: number, actor: string | null, note: string | null = null) =>
    events.push({ id: stableId(`notice-event:${noticeId}:${kind}`), notice_id: noticeId, kind, actor_id: actor, note, created_at: new Date(Math.min(at, now)).toISOString() });

  for (const c of eligible) {
    const domain = pick(domainsOf.get(c.id)!);
    const isAl = /\.al(\.|$)/.test(domain.domain);
    const kinds: Kind[] = ["registrar", ...(rand() < 0.6 ? (["hosting"] as Kind[]) : []), ...(isAl || rand() < 0.25 ? (["akcesk"] as Kind[]) : [])];
    const lastSeen = c.last_seen ? Date.parse(`${c.last_seen}T12:00:00Z`) : now - 5 * DAY;
    const firstSeen = c.first_seen ? Date.parse(`${c.first_seen}T09:00:00Z`) : lastSeen - 10 * DAY;
    const iocs = await iocsOf(c.id);

    for (const kind of kinds) {
      const id = stableId(`notice:${c.id}:${kind}`);
      const locale: "sq" | "en" = kind === "akcesk" || isAl ? "sq" : "en";
      const hay = `${domain.registrar ?? ""} ${domain.hosting_country ?? ""}`.toLowerCase();
      const recips = recipients.filter((r) => r.kind === kind);
      const recipient = recips.find((r) => r.match_pattern && hay.includes(r.match_pattern.toLowerCase())) ?? pick(recips);
      const sla = recipient.sla_hours ?? 24;

      // Timeline anchored on the campaign: drafted 1-3 days after it was first seen.
      const created = Math.min(now - 2 * H, firstSeen + (1 + rand() * 2) * DAY);
      const x = rand();
      let status: Enums["notice_status"];
      if (c.status === "resolved") status = x < 0.78 ? "taken_down" : x < 0.9 ? "no_response" : x < 0.95 ? "rejected" : "acknowledged";
      else if (c.status === "takedown_in_progress") status = x < 0.3 ? "sent" : x < 0.6 ? "acknowledged" : x < 0.85 ? "taken_down" : "no_response";
      else status = x < 0.25 ? "draft" : x < 0.45 ? "in_review" : x < 0.6 ? "approved" : x < 0.9 ? "sent" : "acknowledged";

      const reviewAt = created + (1 + rand() * 5) * H;
      const approvedAt = reviewAt + (0.5 + rand() * 6) * H;
      // Active campaigns: send recently so some are inside the SLA and some are overdue.
      const sentAt = c.status === "confirmed" ? now - rand() * 2.2 * sla * H : approvedAt + rand() * 2 * H;
      const dueAt = sentAt + sla * H;
      const reached = (s: Enums["notice_status"][]) => s.includes(status);
      const approved = reached(["approved", "sent", "acknowledged", "taken_down", "no_response", "rejected"]);
      const sent = reached(["sent", "acknowledged", "taken_down", "no_response", "rejected"]);
      const resolvedAt = status === "taken_down" ? sentAt + (4 + rand() * 60) * H : status === "no_response" ? dueAt + (24 + rand() * 72) * H : status === "rejected" ? sentAt + (6 + rand() * 30) * H : null;
      const lead = pick(leads);

      const year = new Date(created).getUTCFullYear();
      let protocol = existingProtocol.get(id);
      if (!protocol) {
        const seq = (perYear.get(year) ?? 200_000) + 1;
        perYear.set(year, seq);
        protocol = `SOC-${year}/${seq}`;
      }
      const t = tpl.get(`${kind}.${locale}`)!;
      const vars = {
        protocol,
        campaign_code: c.code,
        domain: defang(domain.domain),
        imitated_institution: c.imitated_name ?? (locale === "sq" ? "një institucion" : "an institution"),
        first_seen: c.first_seen ?? "—",
        report_count: String(reportCount.get(c.id) ?? 0),
        iocs: iocs.length ? iocs.map((i) => `- ${i.type}: ${defang(i.value.replace(/\[\.\]/g, "."))}`).join("\n") : "-",
        evidence_summary: locale === "sq"
          ? `Mesazhe të maskuara, të dhëna whois dhe certifikata për ${defang(domain.domain)}, kronologjia e fushatës ${c.code}.`
          : `Masked messages, whois and certificate facts for ${defang(domain.domain)}, timeline of campaign ${c.code}.`,
        analyst_name: analystProfile?.full_name ?? "Analist Demo",
        org_name: "Mburoja SOC",
      };
      const subject = render(t.subject, vars);
      const body = render(t.body, vars);

      notices.push({
        id, protocol, campaign_id: c.id, domain_id: domain.id, kind, recipient_id: recipient.id, status, subject, body,
        created_by: analyst,
        approved_by: approved ? lead : null,
        sent_at: sent ? new Date(Math.min(sentAt, now)).toISOString() : null,
        due_at: sent ? new Date(dueAt).toISOString() : null,
        resolved_at: resolvedAt ? new Date(Math.min(resolvedAt, now)).toISOString() : null,
        created_at: new Date(created).toISOString(),
      });

      ev(id, "created", created, analyst);
      if (status !== "draft") ev(id, "submitted_for_review", reviewAt, analyst);
      if (approved) ev(id, "approved", approvedAt, lead);
      if (sent) {
        ev(id, "sent", sentAt, lead, `${recipient.name} <${recipient.abuse_email}> (simulated)`);
        outbox.push({ id: stableId(`outbox:${id}`), to_address: recipient.abuse_email, subject, body, kind: "takedown_notice", entity: "takedown_notice", entity_id: id, simulated: true, sent_at: new Date(Math.min(sentAt, now)).toISOString() });
      }
      if (status === "acknowledged") ev(id, "reply", sentAt + (2 + rand() * 20) * H, null, locale === "sq" ? "Kërkesa u mor, po shqyrtohet." : "Ticket received, under review.");
      if (status === "taken_down") {
        if (rand() < 0.5) ev(id, "reply", sentAt + (1 + rand() * 4) * H, null, "Ticket received.");
        ev(id, "taken_down", resolvedAt!, lead, locale === "sq" ? "Domeni u pezullua." : "Domain suspended.");
      }
      if (status === "no_response") ev(id, "escalated", resolvedAt!, lead, locale === "sq" ? "Pa përgjigje pas afatit: eskaluar te AKCESK." : "No reply after the SLA: escalated to the national authority.");
      if (status === "rejected") ev(id, "reply", resolvedAt!, null, "Rejected: insufficient evidence.");
    }
  }

  for (const part of chunks(notices, 200)) must(await db.from("takedown_notices").upsert(part, { onConflict: "id" }), "notices");
  for (const part of chunks(events, 500)) must(await db.from("notice_events").upsert(part, { onConflict: "id" }), "notice events");
  for (const part of chunks(outbox, 200)) must(await db.from("outbox").upsert(part, { onConflict: "id" }), "outbox");

  // Campaigns with notices out but not all resolved are "takedown in progress".
  const open = new Set(notices.filter((n) => ["sent", "acknowledged", "approved", "in_review"].includes(n.status!)).map((n) => n.campaign_id));
  for (const id of open) must(await db.from("campaigns").update({ status: "takedown_in_progress" }).eq("id", id).eq("status", "confirmed"), "campaign status");

  const by = notices.reduce<Record<string, number>>((m, n) => ({ ...m, [n.status!]: (m[n.status!] ?? 0) + 1 }), {});
  const overdue = notices.filter((n) => (n.status === "sent" || n.status === "acknowledged") && n.due_at && Date.parse(n.due_at) < now).length;
  console.log(`⚠ SYNTHETIC takedown notices (sending simulated): ${notices.length} for ${eligible.length} campaigns, ${events.length} events, ${outbox.length} outbox rows`);
  console.table({ ...by, overdue });
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
