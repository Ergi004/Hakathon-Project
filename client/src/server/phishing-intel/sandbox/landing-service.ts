import "server-only";

import { audit } from "@/server/audit";
import type { AdminClient } from "@/server/db";
import { defang } from "@/server/detection/normalize";
import { limit } from "@/server/rate-limit";
import type { Json, TablesInsert } from "@/types/database";
import { isIPv4, isPrivateIPv4 } from "../intelligence/ioc-extractor";
import { lookupReputation } from "../intelligence/virustotal/reputation";
import type { ExtractedIoc } from "../types";
import { pickScripts, processLanding } from "./landing-processor";
import { landingKey, sanitizeForSandbox } from "./sanitize";
import { createUrlscanClient, UrlscanError } from "./urlscan";

/**
 * Landing-page analysis via urlscan.io (analyst-triggered, observation only).
 * The platform sends a sanitised URL to urlscan and reads back what urlscan
 * recorded; it never opens the page itself (hard rule 6).
 */

const NON_ROUTABLE = /\.(example|test|invalid|localhost|local|internal|lan|home|arpa)$/i;
const POLL_FIRST_MS = 10_000;
const POLL_EVERY_MS = 4_000;
const GIVE_UP_MS = 4 * 60_000;

const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export function urlscanConfig() {
  const vis = process.env.URLSCAN_VISIBILITY;
  return {
    // URLSCAN_TOTAL_API_KEY is the name used in this project's .env.local.
    apiKey: process.env.URLSCAN_API_KEY || process.env.URLSCAN_TOTAL_API_KEY || undefined,
    baseUrl: process.env.URLSCAN_BASE_URL || "https://urlscan.io",
    visibility: (vis === "public" || vis === "private" ? vis : "unlisted") as "public" | "unlisted" | "private",
    country: process.env.URLSCAN_COUNTRY || undefined,
    dailyLimit: num("URLSCAN_DAILY_LIMIT", 100),
    perUserHour: num("URLSCAN_PER_USER_HOUR", 20),
  };
}

const client = () => {
  const c = urlscanConfig();
  return createUrlscanClient({ apiKey: c.apiKey, baseUrl: c.baseUrl });
};

export type LandingBlock = "synthetic" | "private_ip" | "invalid";

/** Why a URL cannot go to the sandbox (shown to the analyst before they click). */
export function landingBlock(url: string): LandingBlock | null {
  const s = sanitizeForSandbox(url);
  if (!s) return "invalid";
  const host = new URL(s.url).hostname.toLowerCase();
  if (NON_ROUTABLE.test(host) || !host.includes(".")) return "synthetic";
  if (isIPv4(host) && isPrivateIPv4(host)) return "private_ip";
  return null;
}

export type StartResult = { ok: true; id: string; reused: boolean; pending: boolean } | { ok: false; error: string; message?: string };

export async function startLanding(db: AdminClient, input: { scanId: string; url: string; userId: string }): Promise<StartResult> {
  const cfg = urlscanConfig();
  if (!cfg.apiKey) return { ok: false, error: "not_configured" };

  // Only URLs this scan actually contains: the button cannot be used to scan arbitrary sites.
  const { data: ioc } = await db.from("scan_iocs").select("normalized_value").eq("scan_id", input.scanId).eq("type", "url").eq("normalized_value", input.url).maybeSingle();
  if (!ioc) return { ok: false, error: "not_in_scan" };
  const block = landingBlock(input.url);
  if (block) return { ok: false, error: block };
  const s = sanitizeForSandbox(input.url)!;
  const key = landingKey(s.url);

  // Same page analysed in the last 24 h (any scan): reuse instead of spending quota.
  const { data: prev } = await db
    .from("landing_analyses")
    .select("*")
    .eq("url_key", key)
    .in("status", ["submitted", "completed"])
    .gt("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prev) {
    const { id: _id, created_at: _c, updated_at: _u, ...copy } = prev;
    void _id;
    void _c;
    void _u;
    const { data: row } = await db.from("landing_analyses").insert({ ...copy, scan_id: input.scanId, requested_by: input.userId }).select("id, status").single();
    if (!row) return { ok: false, error: "error" };
    if (row.status === "completed") await linkIocs(db, input.scanId, row.id, prev.exfil as unknown as LandingExfil[], prev.final_domain);
    await audit({ actorId: input.userId, action: "landing.reuse", entity: "phishing_scan", entityId: input.scanId, data: { from: prev.id, host: new URL(s.url).hostname } });
    return { ok: true, id: row.id, reused: true, pending: row.status === "submitted" };
  }

  const perUser = await limit(`urlscan:user:${input.userId}`, cfg.perUserHour, 3600);
  if (!perUser.allowed) return { ok: false, error: "rate_limited_user" };
  const perDay = await limit("urlscan:day", cfg.dailyLimit, 86_400);
  if (!perDay.allowed) return { ok: false, error: "rate_limited_day" };

  const { data: row, error } = await db
    .from("landing_analyses")
    .insert({ scan_id: input.scanId, url: s.url, url_key: key, requested_by: input.userId, sanitized: s.replaced as unknown as Json, visibility: cfg.visibility })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "error" };

  try {
    const sub = await client().submit(s.url, { visibility: cfg.visibility, tags: ["mburoja", "phishing-intel"], country: cfg.country });
    await db
      .from("landing_analyses")
      .update({ status: "submitted", provider_uuid: sub.uuid, result_url: sub.resultUrl, visibility: sub.visibility, screenshot_url: `${cfg.baseUrl}/screenshots/${sub.uuid}.png` })
      .eq("id", row.id);
    await db.from("scan_events").insert({ scan_id: input.scanId, stage: "landing", status: "submitted", message: `urlscan.io ${sub.visibility}: ${defang(new URL(s.url).hostname)}` });
  } catch (e) {
    const code = e instanceof UrlscanError ? e.code : "upstream";
    const message = (e instanceof Error ? e.message : "").slice(0, 300);
    await db.from("landing_analyses").update({ status: "failed", error: `${code}: ${message}` }).eq("id", row.id);
    return { ok: false, error: `urlscan_${code}`, message };
  }
  await audit({ actorId: input.userId, action: "landing.submit", entity: "phishing_scan", entityId: input.scanId, data: { analysis: row.id, host: new URL(s.url).hostname, visibility: cfg.visibility, replaced: s.replaced } });
  return { ok: true, id: row.id, reused: false, pending: true };
}

type LandingExfil = ReturnType<typeof processLanding>["exfil"][number];

/** Landing-page destinations join the scan's indicators, so KPIs and cross-scan correlation include them. */
async function linkIocs(db: AdminClient, scanId: string, analysisId: string, exfil: LandingExfil[], finalDomain: string | null) {
  const rows: TablesInsert<"scan_iocs">[] = exfil.map((e) => ({
    scan_id: scanId,
    type: "exfil_endpoint",
    value: e.display,
    normalized_value: e.key,
    location: "landing_page",
    subtype: e.kind,
    detail: { source: "landing_page", via: e.via, analysis: analysisId, ...(e.origin ? { origin: e.origin } : {}), ...(e.method ? { method: e.method } : {}), ...(e.chatId ? { chatId: e.chatId } : {}), ...(e.secretHash ? { secretHash: e.secretHash } : {}) } as Json,
  }));
  if (finalDomain) rows.push({ scan_id: scanId, type: "domain", value: defang(finalDomain), normalized_value: finalDomain.toLowerCase(), location: "landing_page", subtype: null, detail: { analysis: analysisId } as Json });
  if (rows.length) await db.from("scan_iocs").upsert(rows, { onConflict: "scan_id,type,normalized_value", ignoreDuplicates: true });
}

/** One poll. "pending" while urlscan is still rendering. */
export async function pollLanding(db: AdminClient, id: string): Promise<"pending" | "completed" | "failed"> {
  const { data: a } = await db.from("landing_analyses").select("*").eq("id", id).maybeSingle();
  if (!a) return "failed";
  if (a.status !== "submitted" || !a.provider_uuid) return a.status === "completed" ? "completed" : a.status === "failed" ? "failed" : "pending";
  const uc = client();
  let result;
  try {
    result = await uc.result(a.provider_uuid);
  } catch (e) {
    const code = e instanceof UrlscanError ? e.code : "upstream";
    if (code === "quota" || code === "timeout" || code === "upstream") return "pending";
    await db.from("landing_analyses").update({ status: "failed", error: `${code}: ${(e as Error).message}`.slice(0, 300) }).eq("id", id);
    return "failed";
  }
  if (!result) {
    if (Date.now() - Date.parse(a.created_at) > GIVE_UP_MS) {
      await db.from("landing_analyses").update({ status: "failed", error: "timeout: urlscan did not finish in time" }).eq("id", id);
      return "failed";
    }
    await db.from("landing_analyses").update({ attempts: a.attempts + 1 }).eq("id", id);
    return "pending";
  }

  const dom = await uc.dom(a.provider_uuid).catch(() => null);
  const scripts = (
    await Promise.all(pickScripts(result).map(async (s) => ({ url: s.url, body: (await uc.response(s.hash).catch(() => null)) ?? "" })))
  ).filter((s) => s.body);
  const f = processLanding(result, dom, scripts);

  // VirusTotal for the final domain and the data destinations' hosts (same cache and quota as scans).
  const hosts = [...new Set([f.finalDomain, ...f.exfil.map((e) => e.host)].filter((h): h is string => !!h))];
  const iocs: ExtractedIoc[] = hosts.map((h) => ({ type: isIPv4(h) ? "ip" : "domain", normalized: h, display: defang(h), locations: ["body"] }));
  const rep = iocs.length ? await lookupReputation(db, iocs, new Set()) : null;

  await db
    .from("landing_analyses")
    .update({
      status: "completed",
      final_url: f.finalUrl,
      final_domain: f.finalDomain,
      page: f.page as Json,
      verdict: f.verdict as unknown as Json,
      forms: f.forms as unknown as Json,
      exfil: f.exfil as unknown as Json,
      requests: { ...f.requests, ipLookup: f.ipLookup } as unknown as Json,
      reputation: (rep?.reputations ?? []).map((r) => ({ type: r.type, value: r.value, found: r.found, malicious: r.malicious, suspicious: r.suspicious, label: r.threatLabel })) as unknown as Json,
      screenshot_url: result.task.screenshotURL ?? a.screenshot_url,
      result_url: result.task.reportURL ?? a.result_url,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  await linkIocs(db, a.scan_id, id, f.exfil, f.finalDomain);
  await db.from("scan_events").insert({
    scan_id: a.scan_id,
    stage: "landing",
    status: "completed",
    message: `${f.forms.length} form(s), ${f.exfil.length} data destination(s)${f.verdict.malicious ? ", urlscan: malicious" : ""}`,
  });
  return "completed";
}

/** Runs after the action responds: urlscan usually finishes in 10-30 s. */
export async function runLandingPoll(db: AdminClient, id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, POLL_FIRST_MS));
  const until = Date.now() + GIVE_UP_MS;
  while (Date.now() < until) {
    const s = await pollLanding(db, id);
    if (s !== "pending") return;
    await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
  }
}

/** Cron safety net (`/api/cron/poll-landing`): finishes analyses whose after() poll was cut short. */
export async function sweepLanding(db: AdminClient) {
  const { data } = await db.from("landing_analyses").select("id").eq("status", "submitted").lt("updated_at", new Date(Date.now() - 20_000).toISOString()).limit(10);
  let done = 0;
  for (const a of data ?? []) if ((await pollLanding(db, a.id)) !== "pending") done += 1;
  return { checked: data?.length ?? 0, done };
}
