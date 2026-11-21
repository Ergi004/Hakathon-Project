import "server-only";

import { revalidateTag } from "next/cache";
import { supabaseCampaignRepo } from "@/server/campaign-repo";
import type { AdminClient } from "@/server/db";
import { assignCampaign } from "@/server/detection/campaigns";
import { createContext } from "@/server/detection/context";
import { scoreDomain } from "@/server/detection/domain-score";
import { loadContextData } from "@/server/detection/load-context";
import { scoreWhois } from "@/server/detection/whois-score";
import { audit } from "@/server/audit";
import { sweepLanding } from "@/server/phishing-intel/sandbox/landing-service";
import { sweepScans } from "@/server/phishing-intel/scan-service";

const H = 3_600_000;

async function notify(db: AdminClient, userIds: string[], title: string, href: string, body?: string) {
  const rows = [...new Set(userIds)].map((user_id) => ({ user_id, title, href, body: body ?? null }));
  if (rows.length) await db.from("notifications").insert(rows);
}
async function leadIds(db: AdminClient) {
  const { data } = await db.from("profiles").select("id").in("platform_role", ["soc_lead", "platform_admin"]);
  return (data ?? []).map((p) => p.id);
}

/** SPEC 11.1 step 6: sent notices past due_at → no_response, task, notify leads. */
export async function escalateOverdue(db: AdminClient) {
  const { data } = await db.from("takedown_notices").select("id, protocol, campaign_id, created_by").eq("status", "sent").lt("due_at", new Date().toISOString());
  const leads = await leadIds(db);
  for (const n of data ?? []) {
    await db.from("takedown_notices").update({ status: "no_response" }).eq("id", n.id);
    await db.from("notice_events").insert({ notice_id: n.id, kind: "escalated", note: "SLA expired" });
    await db.from("cases").insert({ title: `Follow up overdue takedown ${n.protocol}`, campaign_id: n.campaign_id, priority: "high", created_by: n.created_by, due_at: new Date(Date.now() + 24 * H).toISOString() });
    await notify(db, leads, `Takedown ${n.protocol} has no response`, `/soc/takedowns/${n.id}`);
    await audit({ actorId: null, action: "notice.escalate", entity: "takedown_notice", entityId: n.id });
  }
  return { escalated: data?.length ?? 0 };
}

/** SPEC 13.3 evaluate-alerts: rules like "more than 20 reports in 1 h for one institution". */
export async function evaluateAlerts(db: AdminClient) {
  const { data: rules } = await db.from("alert_rules").select("id, name, condition, channel, created_by").eq("active", true);
  const leads = await leadIds(db);
  let fired = 0;
  for (const r of rules ?? []) {
    const c = r.condition as { metric: string; op: ">" | ">=" | "<"; value: number; institution?: string | null };
    const windowMs = c.metric.endsWith("per_day") ? 24 * H : H;
    const since = new Date(Date.now() - windowMs).toISOString();
    const { data: last } = await db.from("alert_events").select("fired_at").eq("rule_id", r.id).gte("fired_at", since).limit(1);
    if (last?.length) continue; // fire at most once per window
    let value = 0;
    if (c.metric === "new_domains_per_day") {
      value = (await db.from("domains").select("id", { count: "exact", head: true }).gte("first_seen_at", since)).count ?? 0;
    } else {
      let q = db.from("reports").select("id, flag, messages(institutions(name))").gte("created_at", since).limit(10000);
      if (c.metric === "high_risk_per_hour") q = q.in("flag", ["red", "darkred"]);
      const rows = (await q).data ?? [];
      value = c.institution ? rows.filter((x) => (x.messages as { institutions: { name: string } | null } | null)?.institutions?.name === c.institution).length : rows.length;
    }
    const hit = c.op === ">" ? value > c.value : c.op === ">=" ? value >= c.value : value < c.value;
    if (!hit) continue;
    fired += 1;
    await db.from("alert_events").insert({ rule_id: r.id, value, data: c });
    await notify(db, [...leads, ...(r.created_by ? [r.created_by] : [])], `Alert: ${r.name} (${value})`, "/soc/alerts");
    if (r.channel === "email") {
      const { sendMail } = await import("@/server/email");
      await sendMail({ to: "soc-oncall@mburoja.example", subject: `Alert: ${r.name}`, body: `${c.metric} ${c.op} ${c.value}: ${value}`, kind: "alert" });
    }
  }
  return { rules: rules?.length ?? 0, fired };
}

/**
 * SPEC 13.3 detect-lookalikes: score new domains / certificates, update domains,
 * create brand_alerts for verified brand_assets and notify security members.
 */
export async function detectLookalikes(db: AdminClient) {
  const ctx = createContext(await loadContextData());
  const since = new Date(Date.now() - 24 * H).toISOString();
  const [{ data: doms }, { data: certs }] = await Promise.all([
    db.from("domains").select("id, domain, class, status, registered_at, age_days, privacy, registrar, hosting_country").gte("first_seen_at", since).limit(2000),
    db.from("certificates").select("san, domain_id").limit(2000),
  ]);
  // Hosts seen only in CT logs become watched domains.
  const known = new Set((doms ?? []).map((d) => d.domain));
  const ctHosts = [...new Set((certs ?? []).flatMap((c) => c.san))].filter((h) => !known.has(h) && scoreDomain(h, ctx).lookalike);
  if (ctHosts.length) await db.from("domains").upsert(ctHosts.map((domain) => ({ domain, in_ct_log: true, status: "watching" })), { onConflict: "domain", ignoreDuplicates: true });

  const { data: assets } = await db.from("brand_assets").select("org_id, kind, value").in("kind", ["domain", "brand_name"]).not("verified_at", "is", null);
  const { data: all } = await db.from("domains").select("id, domain, status, registered_at, age_days, privacy, registrar, hosting_country").or(`first_seen_at.gte.${since},domain.in.(${ctHosts.map((h) => `"${h}"`).join(",") || '""'})`).limit(3000);
  let alerts = 0;
  for (const d of all ?? []) {
    if (d.status === "allowlisted") continue;
    const f = scoreDomain(d.domain, ctx);
    if (!f.lookalike) continue;
    const w = scoreWhois(d.domain, ctx);
    const risk = Math.min(100, ({ homoglyph: 70, typosquat: 60, subdomain_trick: 60, combosquat: 55 } as const)[f.lookalike.cls] + (w?.young ? 15 : 0) + (f.punycode ? 10 : 0) + (w?.privacy ? 5 : 0));
    await db.from("domains").update({ class: f.lookalike.cls === "subdomain_trick" ? "combosquat" : f.lookalike.cls, imitates_domain: f.lookalike.imitates, imitates_institution_id: f.lookalike.institutionId, rule: `${f.lookalike.cls}:${f.lookalike.imitates}`, risk_score: risk, status: d.status === "watching" && risk >= 60 ? "threat" : d.status }).eq("id", d.id);

    const core = d.domain.toLowerCase();
    const orgs = new Set((assets ?? []).filter((a) => (a.kind === "domain" && a.value === f.lookalike!.imitates) || (a.kind === "brand_name" && core.includes(a.value.toLowerCase().replace(/\s+/g, "")))).map((a) => a.org_id));
    for (const org of orgs) {
      const { data: existing } = await db.from("brand_alerts").select("id").eq("org_id", org).eq("domain_id", d.id).limit(1);
      if (existing?.length) continue;
      await db.from("brand_alerts").insert({ org_id: org, domain_id: d.id, severity: risk >= 80 ? "critical" : risk >= 60 ? "high" : "medium", title: `Lookalike domain ${d.domain.replace(/\./g, "[.]")} (${f.lookalike.cls})` });
      const { data: members } = await db.from("organization_members").select("user_id").eq("org_id", org).in("role", ["owner", "admin", "security"]);
      await notify(db, (members ?? []).map((m) => m.user_id), `New lookalike: ${d.domain.replace(/\./g, "[.]")}`, "/business/alerts");
      alerts += 1;
    }
  }
  revalidateTag("detection", "max");
  return { scanned: all?.length ?? 0, ctHosts: ctHosts.length, alerts };
}

/** SPEC 6.4 step 4 over unlinked recent messages; updates counts. */
export async function clusterCampaigns(db: AdminClient) {
  const since = new Date(Date.now() - 48 * H).toISOString();
  const { data } = await db.from("messages").select("id, body_masked, body_hash, urls, institution_id, tactic, created_at").is("campaign_id", null).neq("label", "legitimate").gte("created_at", since).limit(1000);
  const repo = supabaseCampaignRepo(db);
  let linked = 0;
  for (const m of data ?? []) {
    const match = await assignCampaign(
      { iocs: (m.urls ?? []).map((u) => ({ kind: "url" as const, value: u.replace(/\[\.\]/g, ".") })), bodyHash: m.body_hash, maskedBody: m.body_masked, institutionId: m.institution_id ?? undefined, tactic: m.tactic ?? undefined, seenAt: new Date(m.created_at) },
      repo,
    );
    if (match?.id && match.matchType !== "similar") {
      await db.from("messages").update({ campaign_id: match.id }).eq("id", m.id);
      await db.from("reports").update({ campaign_id: match.id }).eq("message_id", m.id).is("campaign_id", null);
      linked += 1;
    }
  }
  // Refresh message_count / last_seen for touched campaigns.
  const { data: camps } = await db.from("campaigns").select("id").gte("updated_at", since).limit(500);
  for (const c of camps ?? []) {
    const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("campaign_id", c.id);
    const { data: last } = await db.from("messages").select("created_at").eq("campaign_id", c.id).order("created_at", { ascending: false }).limit(1);
    await db.from("campaigns").update({ message_count: count ?? 0, ...(last?.[0] ? { last_seen: last[0].created_at.slice(0, 10) } : {}) }).eq("id", c.id);
  }
  return { scanned: data?.length ?? 0, linked };
}

export async function refreshKpis() {
  revalidateTag("kpis", "max");
  revalidateTag("feed", "max");
  return { ok: true };
}

/** SPEC 13.3 / 15.2 retention. */
export async function purgePrivacy(db: AdminClient) {
  const d = (days: number) => new Date(Date.now() - days * 24 * H).toISOString();
  const checks = await db.from("checks").delete({ count: "exact" }).lt("created_at", d(90));
  const { data: stale } = await db.from("reports").select("message_id").not("status", "in", "(confirmed,takedown_requested,taken_down)").lt("created_at", d(180)).not("message_id", "is", null).limit(5000);
  const ids = (stale ?? []).map((r) => r.message_id!).filter(Boolean);
  const msgs = ids.length ? await db.from("messages").delete({ count: "exact" }).in("id", ids).is("campaign_id", null) : { count: 0 };
  const hashes = await db.from("known_hashes").delete({ count: "exact" }).lt("last_seen", d(365));
  const { data: files } = await db.storage.from("exports").list("", { limit: 1000 });
  const old = (files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) < Date.now() - 24 * H).map((f) => f.name);
  if (old.length) await db.storage.from("exports").remove(old);
  await audit({ actorId: null, action: "privacy.purge", entity: "system", data: { checks: checks.count ?? 0, messages: msgs.count ?? 0, hashes: hashes.count ?? 0, exports: old.length } });
  return { checks: checks.count ?? 0, messages: msgs.count ?? 0, hashes: hashes.count ?? 0, exports: old.length };
}

export const JOBS = {
  "compute-geo-hotspots": async (db: AdminClient) => (await import("@/server/geo/compute")).computeGeoHotspots(db),
  "rebuild-region-stats": async (db: AdminClient) => (await import("@/server/geo/compute")).rebuildRegionStats(db),
  "poll-deep-scans": async (db: AdminClient) => (await import("@/server/intel/orchestrator")).continueDeepScans(db),
  "escalate-overdue": escalateOverdue,
  "evaluate-alerts": evaluateAlerts,
  "detect-lookalikes": detectLookalikes,
  "cluster-campaigns": clusterCampaigns,
  "refresh-kpis": () => refreshKpis(),
  "purge-privacy": purgePrivacy,
  /** Phishing Intelligence: pick up queued scans and recover scans stuck in processing. */
  "process-scans": sweepScans,
  /** Landing-page sandbox (urlscan.io): finish analyses whose poll was cut short. */
  "poll-landing": sweepLanding,
} as const;
export type JobName = keyof typeof JOBS;
