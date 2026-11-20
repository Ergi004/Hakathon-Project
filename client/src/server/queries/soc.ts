import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchedSignal } from "@/server/detection/pattern";
import { readClaimedPlace, readHostingCountry, readMatchedSignals } from "@/server/detection/stored-features";
import type { Database, Enums } from "@/types/database";

type DB = SupabaseClient<Database>;
export type ReportStatus = Enums<"report_status">;

const DAY = 86_400_000;

/* ---------------------------------------------------------------- A1 command centre */

export async function getSocKpis(db: DB) {
  const since = new Date(Date.now() - DAY).toISOString();
  const [newReports, highRisk, active, awaiting, resolved] = await Promise.all([
    db.from("reports").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("reports").select("id", { count: "exact", head: true }).in("flag", ["red", "darkred"]).in("status", ["received", "under_review"]),
    db.from("campaigns").select("id", { count: "exact", head: true }).in("status", ["monitoring", "confirmed", "takedown_in_progress"]),
    db.from("takedown_notices").select("id", { count: "exact", head: true }).eq("status", "in_review"),
    db.from("takedown_notices").select("sent_at, resolved_at").eq("status", "taken_down").not("sent_at", "is", null).not("resolved_at", "is", null).limit(500),
  ]);
  const durations = (resolved.data ?? []).map((n) => (Date.parse(n.resolved_at!) - Date.parse(n.sent_at!)) / 3_600_000).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  return {
    newReports: newReports.count ?? 0,
    highRisk: highRisk.count ?? 0,
    activeCampaigns: active.count ?? 0,
    awaitingApproval: awaiting.count ?? 0,
    medianTakedownHours: median === null ? null : Math.round(median * 10) / 10,
  };
}

export async function getDailyVolume(db: DB, days = 14) {
  const { data } = await db.from("soc_daily_volume").select("day, flag, n");
  const start = new Date(Date.now() - (days - 1) * DAY);
  start.setUTCHours(0, 0, 0, 0);
  const rows: Record<string, string | number>[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * DAY).toISOString().slice(0, 10);
    const row: Record<string, string | number> = { day: d, green: 0, yellow: 0, orange: 0, red: 0, darkred: 0, grey: 0 };
    for (const r of data ?? []) if (r.day === d && r.flag) row[r.flag] = (Number(row[r.flag]) || 0) + (r.n ?? 0);
    rows.push(row);
  }
  return rows;
}

export async function getRecentActivity(db: DB, limit = 15) {
  const { data } = await db
    .from("report_events")
    .select("id, kind, data, created_at, report_id, reports(protocol, flag), actor:profiles!report_events_actor_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getNeedsAttention(db: DB) {
  const now = new Date().toISOString();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [overdue, unassigned, todayReports] = await Promise.all([
    db.from("takedown_notices").select("id, protocol, due_at").eq("status", "sent").lt("due_at", now).order("due_at").limit(10),
    db.from("reports").select("id", { count: "exact", head: true }).in("flag", ["red", "darkred"]).is("assigned_to", null).in("status", ["received", "under_review"]),
    db.from("reports").select("messages(institution_id, institutions(name))").gte("created_at", today.toISOString()).limit(2000),
  ]);
  const byInst = new Map<string, number>();
  for (const r of todayReports.data ?? []) {
    const name = (r.messages as { institutions: { name: string } | null } | null)?.institutions?.name;
    if (name) byInst.set(name, (byInst.get(name) ?? 0) + 1);
  }
  const spikes = [...byInst.entries()].filter(([, n]) => n >= 20).map(([name, count]) => ({ name, count }));
  return { overdue: overdue.data ?? [], unassigned: unassigned.count ?? 0, spikes };
}

/* ---------------------------------------------------------------- A2 inbox */

export interface InboxFilters {
  q?: string;
  status?: ReportStatus;
  flag?: Enums<"flag_level">;
  channel?: Enums<"msg_channel">;
  source?: Enums<"report_source">;
  assigned?: "me" | "none";
  page?: number;
}
export const INBOX_PAGE = 50;

export async function getInbox(db: DB, f: InboxFilters, userId: string) {
  const page = Math.max(1, f.page ?? 1);
  let q = db
    .from("reports")
    .select(
      "id, protocol, status, flag, score, channel, source, created_at, assigned_to, campaigns(code), messages(body_masked, institutions(name)), assignee:profiles!reports_assigned_to_fkey(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * INBOX_PAGE, page * INBOX_PAGE - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.flag) q = q.eq("flag", f.flag);
  if (f.channel) q = q.eq("channel", f.channel);
  if (f.source) q = q.eq("source", f.source);
  if (f.assigned === "me") q = q.eq("assigned_to", userId);
  if (f.assigned === "none") q = q.is("assigned_to", null);
  if (f.q) {
    const term = f.q.replace(/[%,()]/g, " ").trim();
    if (/^SOC-/i.test(term)) q = q.ilike("protocol", `${term}%`);
    else if (term) {
      const { data: ids } = await db.from("messages").select("id").ilike("body_masked", `%${term}%`).limit(500);
      q = q.in("message_id", (ids ?? []).map((m) => m.id).concat("00000000-0000-0000-0000-000000000000"));
    }
  }
  const { data, count } = await q;
  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      protocol: r.protocol,
      status: r.status,
      flag: r.flag,
      score: r.score,
      channel: r.channel,
      source: r.source,
      created_at: r.created_at,
      campaign: (r.campaigns as { code: string } | null)?.code ?? null,
      institution: (r.messages as { institutions: { name: string } | null } | null)?.institutions?.name ?? null,
      excerpt: ((r.messages as { body_masked: string } | null)?.body_masked ?? "").slice(0, 140),
      assignee: (r.assignee as { full_name: string | null } | null)?.full_name ?? null,
      assigned_to: r.assigned_to,
    })),
    total: count ?? 0,
    page,
    pages: Math.max(1, Math.ceil((count ?? 0) / INBOX_PAGE)),
  };
}
export type InboxRow = Awaited<ReturnType<typeof getInbox>>["rows"][number];

/* ---------------------------------------------------------------- A3 report workspace */

export async function getReportDetail(db: DB, id: string) {
  const { data: r } = await db
    .from("reports")
    .select(
      "*, campaigns(id, code, status, imitated_name), messages(*, institutions(id, name)), assignee:profiles!reports_assigned_to_fkey(id, full_name), reporter_org:organizations!reports_reporter_org_id_fkey(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const msg = r.messages as (Database["public"]["Tables"]["messages"]["Row"] & { institutions: { id: string; name: string } | null }) | null;
  const [events, similar, iocs, ext] = await Promise.all([
    db.from("report_events").select("id, kind, data, created_at, actor:profiles!report_events_actor_id_fkey(full_name)").eq("report_id", id).order("created_at"),
    msg ? db.rpc("similar_messages", { p_message: msg.id, p_limit: 6 }) : Promise.resolve({ data: [] as { id: string; body_masked: string; similarity: number; campaign_id: string | null; created_at: string }[] }),
    msg?.urls?.length
      ? db.from("iocs").select("type, value, campaigns(code)").in("value", [...msg.urls, ...msg.urls.map((u) => u.replace(/^hxxps?:\/\//i, "").split("/")[0])])
      : Promise.resolve({ data: [] as { type: string; value: string; campaigns: { code: string } | null }[] }),
    db.from("extension_reports").select("signals, created_at").eq("report_id", id).maybeSingle(),
  ]);
  return { report: r, message: msg, events: events.data ?? [], similar: similar.data ?? [], iocs: iocs.data ?? [], extension: ext.data };
}

/* ---------------------------------------------------------------- A4/A5 campaigns */

export interface CampaignPattern {
  scamType: string | null;
  brand: string | null;
  size: number;
  firstSeen: string | null;
  lastSeen: string | null;
  confidence: number | null;
  hostingCountry: string | null;
  claimedPlace: string | null;
  matchedSignals: MatchedSignal[];
}

function mode(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function readConfidence(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Classified checks linked to each campaign. Size and dates come from those rows. */
export async function getCampaignPatternMap(db: DB, campaignIds: string[]): Promise<Map<string, CampaignPattern>> {
  const map = new Map<string, CampaignPattern>();
  if (!campaignIds.length) return map;
  const { data } = await db
    .from("checks")
    .select("campaign_id, scam_type, impersonated_brand, confidence, features, created_at")
    .in("campaign_id", campaignIds)
    .not("scam_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  const grouped = new Map<string, NonNullable<typeof data>>();
  for (const row of data ?? []) {
    if (!row.campaign_id) continue;
    const list = grouped.get(row.campaign_id) ?? [];
    list.push(row);
    grouped.set(row.campaign_id, list);
  }
  for (const [campaignId, rows] of grouped) {
    const newest = rows[0];
    const times = rows.map((row) => row.created_at).sort();
    map.set(campaignId, {
      scamType: mode(rows.map((row) => row.scam_type)),
      brand: mode(rows.map((row) => row.impersonated_brand)),
      size: rows.length,
      firstSeen: times[0] ?? null,
      lastSeen: times[times.length - 1] ?? null,
      confidence: readConfidence(newest?.confidence),
      hostingCountry: mode(rows.map((row) => readHostingCountry(row.features))),
      claimedPlace: mode(rows.map((row) => readClaimedPlace(row.features))),
      matchedSignals: readMatchedSignals(newest?.features),
    });
  }
  return map;
}

/** One campaign: exact classified-check count, plus signals from the newest stored features. */
export async function getCampaignPattern(db: DB, campaignId: string): Promise<CampaignPattern | null> {
  const [count, newest, oldest, sample] = await Promise.all([
    db.from("checks").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).not("scam_type", "is", null),
    db.from("checks").select("created_at, confidence, features").eq("campaign_id", campaignId).not("scam_type", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("checks").select("created_at").eq("campaign_id", campaignId).not("scam_type", "is", null).order("created_at", { ascending: true }).limit(1).maybeSingle(),
    db.from("checks").select("scam_type, impersonated_brand, features").eq("campaign_id", campaignId).not("scam_type", "is", null).order("created_at", { ascending: false }).limit(200),
  ]);
  const rows = sample.data ?? [];
  const size = count.count ?? rows.length;
  if (!size) return null;
  const latest = newest.data;
  return {
    scamType: mode(rows.map((row) => row.scam_type)),
    brand: mode(rows.map((row) => row.impersonated_brand)),
    size,
    firstSeen: oldest.data?.created_at ?? null,
    lastSeen: latest?.created_at ?? null,
    confidence: readConfidence(latest?.confidence),
    hostingCountry: mode(rows.map((row) => readHostingCountry(row.features))),
    claimedPlace: mode(rows.map((row) => readClaimedPlace(row.features))),
    matchedSignals: readMatchedSignals(latest?.features),
  };
}

export async function getCampaigns(db: DB, f: { status?: Enums<"campaign_status">; q?: string } = {}) {
  let q = db
    .from("campaigns")
    .select("id, code, tactic, status, severity, message_count, first_seen, last_seen, is_public, source, imitated_name, institutions(name), owner:profiles!campaigns_owner_id_fkey(full_name)")
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(500);
  if (f.status) q = q.eq("status", f.status);
  if (f.q) q = q.or(`code.ilike.%${f.q.replace(/[%,()]/g, "")}%,imitated_name.ilike.%${f.q.replace(/[%,()]/g, "")}%`);
  const { data } = await q;
  return data ?? [];
}

export async function getCampaignDetail(db: DB, id: string) {
  const { data: c } = await db
    .from("campaigns")
    .select("*, institutions(id, name), owner:profiles!campaigns_owner_id_fkey(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const [messages, domains, iocs, notices, notes, reports, advisories] = await Promise.all([
    db.from("messages").select("id, body_masked, channel, label, score, flag, received_at, created_at").eq("campaign_id", id).order("received_at", { ascending: false, nullsFirst: false }).limit(300),
    db.from("campaign_domains").select("domains(id, domain, class, registrar, hosting_country, age_days, status, risk_score)").eq("campaign_id", id),
    db.from("iocs").select("type, value, first_seen").eq("campaign_id", id).order("first_seen").limit(1000),
    db.from("takedown_notices").select("id, protocol, kind, status, due_at, sent_at, domains(domain)").eq("campaign_id", id).order("created_at", { ascending: false }),
    db.from("campaign_notes").select("id, body, created_at, author:profiles!campaign_notes_author_id_fkey(full_name)").eq("campaign_id", id).order("created_at", { ascending: false }),
    db.from("reports").select("id", { count: "exact", head: true }).eq("campaign_id", id),
    db.from("advisories").select("id, slug, title_sq, title_en, status, published_at").eq("campaign_id", id),
  ]);
  const weeks = new Map<string, number>();
  for (const m of messages.data ?? []) {
    const at = m.received_at ?? m.created_at;
    const d = new Date(at);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const k = d.toISOString().slice(0, 10);
    weeks.set(k, (weeks.get(k) ?? 0) + 1);
  }
  return {
    campaign: c,
    messages: messages.data ?? [],
    domains: (domains.data ?? []).map((d) => d.domains).filter((d): d is NonNullable<typeof d> => !!d),
    iocs: iocs.data ?? [],
    notices: notices.data ?? [],
    notes: notes.data ?? [],
    reportCount: reports.count ?? 0,
    advisories: advisories.data ?? [],
    weekly: [...weeks.entries()].sort().map(([week, count]) => ({ week, count })),
  };
}

export async function getStaff(db: DB) {
  const { data } = await db.from("profiles").select("id, full_name, platform_role").in("platform_role", ["soc_analyst", "soc_lead", "platform_admin"]).order("full_name");
  return data ?? [];
}

/* ---------------------------------------------------------------- A6 domains */

export async function getDomains(db: DB, f: { status?: string; cls?: Enums<"domain_class">; q?: string; page?: number } = {}) {
  const page = Math.max(1, f.page ?? 1);
  let q = db
    .from("domains")
    .select("id, domain, class, imitates_domain, rule, registered_at, age_days, registrar, nameserver, hosting_country, privacy, in_ct_log, risk_score, status, first_seen_at, institutions:institutions!domains_imitates_institution_id_fkey(name), certificates(cert_id, issuer, not_before, san)", { count: "exact" })
    .order("first_seen_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (f.status) q = q.eq("status", f.status);
  if (f.cls) q = q.eq("class", f.cls);
  if (f.q) q = q.ilike("domain", `%${f.q.replace(/[%,()]/g, "").replace(/\[\.\]/g, ".")}%`);
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0, page, pages: Math.max(1, Math.ceil((count ?? 0) / 50)) };
}
export type DomainRow = Awaited<ReturnType<typeof getDomains>>["rows"][number];

/* ---------------------------------------------------------------- A7/A8 takedowns */

export async function getNotices(db: DB) {
  const { data } = await db
    .from("takedown_notices")
    .select("id, protocol, kind, status, subject, due_at, sent_at, created_at, campaigns(code), domains(domain), recipients(name), creator:profiles!takedown_notices_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
export type NoticeRow = Awaited<ReturnType<typeof getNotices>>[number];

export async function getNoticeDetail(db: DB, id: string) {
  const { data: n } = await db
    .from("takedown_notices")
    .select("*, campaigns(id, code, status, imitated_name), domains(id, domain, registrar, hosting_country), recipients(id, name, abuse_email, kind, sla_hours), creator:profiles!takedown_notices_created_by_fkey(id, full_name), approver:profiles!takedown_notices_approved_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!n) return null;
  const [events, recipients] = await Promise.all([
    db.from("notice_events").select("id, kind, note, created_at, actor:profiles!notice_events_actor_id_fkey(full_name)").eq("notice_id", id).order("created_at"),
    db.from("recipients").select("id, name, abuse_email, kind, sla_hours").eq("kind", n.kind).order("name"),
  ]);
  return { notice: n, events: events.data ?? [], recipients: recipients.data ?? [] };
}

/* ---------------------------------------------------------------- A9 patterns */

export async function getPatterns(db: DB) {
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const [reports, campaigns, domains] = await Promise.all([
    db.from("reports").select("created_at, channel, messages(institutions(name))").gte("created_at", since).limit(10000),
    db.from("campaigns").select("tactic, message_count"),
    db.from("domains").select("registrar, hosting_country").neq("status", "allowlisted").limit(10000),
  ]);
  const count = <T,>(items: T[], key: (t: T) => string | null | undefined, weight: (t: T) => number = () => 1) => {
    const m = new Map<string, number>();
    for (const i of items) {
      const k = key(i);
      if (k) m.set(k, (m.get(k) ?? 0) + weight(i));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  };
  const rs = reports.data ?? [];
  const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of rs) {
    const d = new Date(r.created_at);
    heat[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }
  return {
    byInstitution: count(rs, (r) => (r.messages as { institutions: { name: string } | null } | null)?.institutions?.name).slice(0, 10),
    channels: count(rs, (r) => r.channel),
    tactics: count(campaigns.data ?? [], (c) => c.tactic, (c) => c.message_count || 1).slice(0, 8),
    registrars: count(domains.data ?? [], (d) => d.registrar).slice(0, 10),
    hosting: count(domains.data ?? [], (d) => d.hosting_country).slice(0, 10),
    heat,
  };
}

/* ---------------------------------------------------------------- A10 search */

export async function globalSearch(db: DB, raw: string) {
  const q = raw.trim().slice(0, 200);
  if (q.length < 3) return null;
  const like = `%${q.replace(/[%,()]/g, "").replace(/\[\.\]/g, ".")}%`;
  const [messages, domains, iocs, reports, campaigns] = await Promise.all([
    db.rpc("search_messages", { p_q: q, p_limit: 15 }),
    db.from("domains").select("id, domain, class, status").ilike("domain", like).limit(15),
    db.from("iocs").select("id, type, value, campaigns(id, code)").ilike("value", like.replace(/\./g, "%")).limit(15),
    db.from("reports").select("id, protocol, status, flag").ilike("protocol", like).limit(10),
    db.from("campaigns").select("id, code, imitated_name, status").or(`code.ilike.${like},imitated_name.ilike.${like}`).limit(10),
  ]);
  return { messages: messages.data ?? [], domains: domains.data ?? [], iocs: iocs.data ?? [], reports: reports.data ?? [], campaigns: campaigns.data ?? [] };
}
