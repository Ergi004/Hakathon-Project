import "server-only";

import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { DEFAULT_THRESHOLDS } from "@/lib/flags";
import type { AdminClient } from "@/server/db";
import { tryAdmin } from "@/server/db";
import { officialCores, scoreDomain } from "@/server/detection/domain-score";
import { loadContext } from "@/server/detection/load-context";
import { defang, refang } from "@/server/detection/normalize";
import type { Reason } from "@/server/detection/types";
import { randomToken, sha256 } from "@/server/hash";
import type { Json } from "@/types/database";
import { cacheGet, cacheKey, cacheSet } from "./cache";
import { circuitOpen, recordOutcome, takeToken } from "./limits";
import { isF019, mockDelay, mockResult, mockSubdomains } from "./mock";
import { intelMode, liveProviders } from "./providers";
import { failureReason } from "./providers/http";
import { sanitizeForIntel, type Eligibility } from "./sanitize";
import { foldIntel, intelVerdictReasons, lifetimeReasons, rankSubdomains, subdomainReasons } from "./scoring";
import type { IntelProviderName, ProviderResult, SubdomainRow } from "./types";
import { unavailable } from "./types";

const TIER_A: (IntelProviderName | "internal")[] = ["dns", "rdap", "urlhaus", "crtsh", "virustotal", "internal"];
const TIER_B: IntelProviderName[] = ["virustotal", "hybrid_analysis"];
const PROVIDER_TIMEOUT_MS = 8000;
const DEEP_DEADLINE_MS = 5 * 60_000;
const POLL_MS = 5000;

type Eligible = Extract<Eligibility, { ok: true }>;
export type StartResult = { ok: true; scanId: string; token: string } | { ok: false; reason: string };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })); }, { once: true });
  });

/* ------------------------------------------------------------------ eligibility */

async function eligibility(url: string): Promise<{ elig: Eligibility; ctxBrand: string[]; officialSet: Set<string> }> {
  const ctx = await loadContext();
  const db = tryAdmin();
  const { data: allow } = db ? await db.from("domains").select("domain").eq("status", "allowlisted").limit(5000) : { data: [] };
  const officialSet = new Set(ctx.officialDomains.keys());
  const elig = sanitizeForIntel(url, { officialDomains: officialSet, allowlisted: (allow ?? []).map((d) => d.domain), mode: intelMode() });
  const brand = [...new Set([...officialCores(ctx), ...[...ctx.institutions.values()].flatMap((i) => i.folded.map((f) => f.replace(/\s+/g, "")))])].filter((b) => b.length >= 4);
  return { elig, ctxBrand: brand, officialSet };
}

/* ------------------------------------------------------------------ start */

/**
 * Creates the scan and returns immediately; the work continues after the
 * response (after()). Tier B also runs when `deep` is set (explicit consent
 * or an analyst request).
 */
export async function startLiveScan(opts: { url: string; reportId?: string | null; checkId?: string | null; deep?: boolean; requestedBy?: string | null }): Promise<StartResult> {
  const db = tryAdmin();
  if (!db) return { ok: false, reason: "unavailable" };
  const { elig } = await eligibility(opts.url);
  if (!elig.ok) return { ok: false, reason: elig.reason };
  if (elig.synthetic && intelMode() === "live") return { ok: false, reason: "synthetic" };

  let baseScore = 0;
  if (opts.reportId) baseScore = (await db.from("reports").select("score").eq("id", opts.reportId).maybeSingle()).data?.score ?? 0;
  else if (opts.checkId) baseScore = (await db.from("checks").select("score").eq("id", opts.checkId).maybeSingle()).data?.score ?? 0;

  const token = randomToken();
  const { data: scan, error } = await db
    .from("scans")
    .insert({
      token_hash: sha256(token),
      report_id: opts.reportId ?? null,
      check_id: opts.checkId ?? null,
      url_sanitized: defang(elig.url),
      host: elig.host,
      registrable_domain: elig.registrableDomain,
      tier: "A",
      base_score: baseScore,
      final_score: baseScore,
      mock: intelMode() === "mock",
      requested_by: opts.requestedBy ?? null,
    })
    .select("id")
    .single();
  if (error || !scan) return { ok: false, reason: "error" };
  await db.from("scan_results").insert(TIER_A.map((provider) => ({ scan_id: scan.id, provider })));

  after(async () => {
    await runTierA(db, scan.id, elig);
    if (opts.deep) await runDeep(db, scan.id, elig);
  });
  return { ok: true, scanId: scan.id, token };
}

/** Analyst "Run deep scan" on an existing tier A scan. */
export async function startDeepScanFor(parentScanId: string): Promise<{ ok: boolean; reason?: string }> {
  const db = tryAdmin();
  if (!db) return { ok: false, reason: "unavailable" };
  const { data: parent } = await db.from("scans").select("id, url_sanitized").eq("id", parentScanId).single();
  if (!parent) return { ok: false, reason: "notFound" };
  const { elig } = await eligibility(refang(parent.url_sanitized));
  if (!elig.ok) return { ok: false, reason: elig.reason };
  after(() => runDeep(db, parentScanId, elig));
  return { ok: true };
}

/* ------------------------------------------------------------------ provider guard */

export async function guarded(provider: IntelProviderName, subject: string, fn: (signal: AbortSignal) => Promise<ProviderResult>, variant = ""): Promise<ProviderResult> {
  if (circuitOpen(provider)) return unavailable(provider, "circuit_open");
  const key = cacheKey(provider, subject, variant);
  const cached = await cacheGet<ProviderResult>(key);
  if (cached) return { ...cached, summary: { ...cached.summary, cached: true } };
  if (!takeToken(provider)) return unavailable(provider, "rate_limited");
  const signal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  try {
    const r = await Promise.race([fn(signal), sleep(PROVIDER_TIMEOUT_MS + 200).then(() => unavailable(provider, "timeout"))]);
    recordOutcome(provider, r.status === "done");
    if (r.status === "done") await cacheSet(key, provider, r);
    return r;
  } catch (e) {
    recordOutcome(provider, false);
    return unavailable(provider, failureReason(e));
  }
}

async function runProvider(provider: IntelProviderName, elig: Eligible): Promise<ProviderResult> {
  if (intelMode() === "mock") {
    await sleep(mockDelay(provider));
    return mockResult(provider, elig.host, elig.registrableDomain);
  }
  const p = liveProviders();
  switch (provider) {
    case "dns":
      return guarded("dns", elig.host, (s) => p.dns.host(elig.host, s));
    case "rdap":
      return guarded("rdap", elig.registrableDomain, (s) => p.rdap.domain(elig.registrableDomain, s));
    case "crtsh":
      return guarded("crtsh", elig.registrableDomain, (s) => p.crtsh.domain(elig.registrableDomain, s));
    case "urlhaus":
      return p.urlhaus ? guarded("urlhaus", elig.host, (s) => p.urlhaus!.host(elig.host, s)) : unavailable("urlhaus", "not_configured");
    case "virustotal":
      return p.virustotal ? guarded("virustotal", elig.registrableDomain, (s) => p.virustotal!.domainReport(elig.registrableDomain, s)) : unavailable("virustotal", "not_configured");
    default:
      return unavailable(provider, "not_supported");
  }
}

/* ------------------------------------------------------------------ writes */

async function writeResult(db: AdminClient, scanId: string, r: ProviderResult | (Omit<ProviderResult, "provider"> & { provider: "internal" })) {
  await db
    .from("scan_results")
    .update({
      status: r.status,
      verdict: r.verdict,
      malicious_count: r.maliciousCount ?? null,
      total_count: r.totalCount ?? null,
      summary: r.summary as Json,
      report_url: r.reportUrl ?? null,
      error: r.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("scan_id", scanId)
    .eq("provider", r.provider);
}

/* ------------------------------------------------------------------ tier A */

export async function runTierA(db: AdminClient, scanId: string, elig: Eligible) {
  const { ctxBrand } = await eligibility(elig.url);
  const results: ProviderResult[] = [];

  const internal = (async () => {
    if (intelMode() === "mock") await sleep(mockDelay("internal"));
    const ctx = await loadContext();
    const d = scoreDomain(elig.host, ctx);
    await writeResult(db, scanId, {
      provider: "internal",
      status: "done",
      verdict: d.lookalike ? "suspicious" : "unknown",
      summary: { lookalike: d.lookalike?.cls ?? null, imitates: d.lookalike ? defang(d.lookalike.imitates) : null, punycode: d.punycode, oddTld: d.oddTld },
    });
  })();

  await Promise.allSettled([
    internal,
    ...(["dns", "rdap", "urlhaus", "crtsh", "virustotal"] as const).map(async (p) => {
      const r = await runProvider(p, elig);
      results.push(r);
      await writeResult(db, scanId, r);
      await finalize(db, scanId, { progressive: true });
    }),
  ]);

  await scanSubdomains(db, scanId, elig, results, ctxBrand);
  await finalize(db, scanId, { progressive: false });
}

/** Subdomains from VirusTotal and crt.sh SANs (no brute force, no DNS guessing). */
async function scanSubdomains(db: AdminClient, scanId: string, elig: Eligible, results: ProviderResult[], brand: string[]) {
  const mock = intelMode() === "mock";
  if (mock) await sleep(mockDelay("subdomains") - 3000);
  const crt = results.find((r) => r.provider === "crtsh")?.summary as { names?: { name: string; firstSeen?: string }[] } | undefined;
  let vtNames: string[] = [];
  if (mock) vtNames = mockSubdomains(elig.registrableDomain);
  else {
    const vt = liveProviders().virustotal;
    if (vt && takeToken("virustotal") && !circuitOpen("virustotal")) vtNames = await vt.subdomains(elig.registrableDomain, AbortSignal.timeout(PROVIDER_TIMEOUT_MS));
  }
  const ranked = rankSubdomains(
    [...vtNames.map((name) => ({ name, source: "virustotal" as const })), ...(crt?.names ?? []).map((n) => ({ name: n.name, source: "crtsh" as const, firstSeen: n.firstSeen }))].filter((n) => n.name !== elig.registrableDomain),
    brand,
    50,
  );
  const rows: SubdomainRow[] = [];
  const queue = [...ranked];
  const work = async () => {
    for (let n = queue.shift(); n; n = queue.shift()) {
      const top10 = ranked.indexOf(n) < 10;
      let resolves: boolean | null = null;
      let verdict: SubdomainRow["verdict"] = "unknown";
      if (mock) {
        resolves = isF019(n.name, elig.registrableDomain);
        verdict = isF019(n.name, elig.registrableDomain) && /login|pagesa|verify/.test(n.name) ? "malicious" : "unknown";
      } else {
        const p = liveProviders();
        resolves = (await p.dns.lookup(n.name, AbortSignal.timeout(4000))).resolves;
        const uh = p.urlhaus ? await guarded("urlhaus", n.name, (s) => p.urlhaus!.host(n.name, s)) : null;
        if (uh?.verdict === "malicious") verdict = "malicious";
        if (top10 && verdict !== "malicious" && p.virustotal) {
          const vt = await guarded("virustotal", n.name, (s) => p.virustotal!.domainReport(n.name, s));
          if (vt.status === "done" && vt.verdict !== "unknown") verdict = vt.verdict;
        }
        if (verdict === "unknown" && uh?.status === "done") verdict = "clean";
      }
      rows.push({ subdomain: n.name, source: n.source, resolves, firstCertAt: n.firstSeen ?? null, verdict, brandToken: n.brandToken });
    }
  };
  await Promise.all(Array.from({ length: 5 }, work));
  if (rows.length) {
    await db.from("intel_subdomains").upsert(
      rows.map((r) => ({ scan_id: scanId, registrable_domain: elig.registrableDomain, subdomain: r.subdomain, source: r.source, resolves: r.resolves ?? null, first_cert_at: r.firstCertAt ?? null, verdict: r.verdict, brand_token: r.brandToken })),
      { onConflict: "scan_id,subdomain" },
    );
  }
}

/* ------------------------------------------------------------------ tier B */

export async function runDeep(db: AdminClient, parentScanId: string, elig: Eligible) {
  const { data: parent } = await db.from("scans").select("*").eq("id", parentScanId).single();
  if (!parent) return;
  const { data: child } = await db
    .from("scans")
    .insert({ token_hash: parent.token_hash, parent_scan_id: parent.id, report_id: parent.report_id, check_id: parent.check_id, url_sanitized: parent.url_sanitized, host: parent.host, registrable_domain: parent.registrable_domain, tier: "B", base_score: parent.base_score, mock: parent.mock, requested_by: parent.requested_by })
    .select("id")
    .single();
  if (!child) return;
  await db.from("scan_results").insert(TIER_B.map((provider) => ({ scan_id: child.id, provider })));

  if (intelMode() === "mock") {
    await Promise.all(TIER_B.map(async (p) => { await sleep(mockDelay(p) + 3000); await writeResult(db, child.id, mockResult(p, elig.host, elig.registrableDomain, true)); }));
  } else {
    const prov = liveProviders();
    const url = elig.url;
    for (const p of TIER_B) {
      const adapter = p === "virustotal" ? prov.virustotal : prov.hybridAnalysis;
      if (!adapter) { await writeResult(db, child.id, unavailable(p, "not_configured")); continue; }
      if (circuitOpen(p) || !takeToken(p)) { await writeResult(db, child.id, unavailable(p, circuitOpen(p) ? "circuit_open" : "rate_limited")); continue; }
      try {
        const ref = await adapter.submitUrl(url, AbortSignal.timeout(PROVIDER_TIMEOUT_MS));
        await db.from("scan_results").update({ summary: { ref, phase: "submitted" } }).eq("scan_id", child.id).eq("provider", p);
      } catch (e) {
        recordOutcome(p, false);
        await writeResult(db, child.id, unavailable(p, failureReason(e)));
      }
    }
    const started = Date.now();
    while (Date.now() - started < DEEP_DEADLINE_MS) {
      const pending = await pollDeepOnce(db, child.id);
      if (!pending) break;
      await sleep(POLL_MS);
    }
  }
  await closeDeep(db, child.id);
  await finalize(db, parentScanId, { progressive: false });
}

/** Polls every pending tier B row of a scan once. Returns how many are still pending. */
export async function pollDeepOnce(db: AdminClient, scanId: string): Promise<number> {
  const { data: rows } = await db.from("scan_results").select("provider, summary, started_at").eq("scan_id", scanId).eq("status", "pending");
  const prov = liveProviders();
  let pending = 0;
  for (const row of rows ?? []) {
    const ref = (row.summary as { ref?: string }).ref;
    if (!ref) { pending += 1; continue; }
    if (Date.now() - Date.parse(row.started_at) > DEEP_DEADLINE_MS) {
      await writeResult(db, scanId, { provider: row.provider as IntelProviderName, status: "error", verdict: "unknown", summary: {}, error: "deadline" });
      continue;
    }
    try {
      const r = row.provider === "virustotal" ? await prov.virustotal?.pollAnalysis(ref, AbortSignal.timeout(PROVIDER_TIMEOUT_MS)) : await prov.hybridAnalysis?.poll(ref, AbortSignal.timeout(PROVIDER_TIMEOUT_MS));
      if (r) { recordOutcome(r.provider, true); await writeResult(db, scanId, r); }
      else pending += 1;
    } catch (e) {
      await writeResult(db, scanId, unavailable(row.provider as IntelProviderName, failureReason(e)));
    }
  }
  return pending;
}

async function closeDeep(db: AdminClient, childId: string) {
  await db.from("scan_results").update({ status: "error", error: "deadline", finished_at: new Date().toISOString() }).eq("scan_id", childId).eq("status", "pending");
  await db.from("scans").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", childId);
}

/** Cron poll-deep-scans: continue tier B rows and close scans cut off by the host. */
export async function continueDeepScans(db: AdminClient) {
  const { data: deep } = await db.from("scans").select("id, parent_scan_id, created_at").eq("tier", "B").eq("status", "running").limit(50);
  let closed = 0;
  for (const s of deep ?? []) {
    const pending = intelMode() === "mock" ? 0 : await pollDeepOnce(db, s.id);
    if (!pending || Date.now() - Date.parse(s.created_at) > DEEP_DEADLINE_MS + 60_000) {
      await closeDeep(db, s.id);
      if (s.parent_scan_id) await finalize(db, s.parent_scan_id, { progressive: false });
      closed += 1;
    }
  }
  const { data: stale } = await db.from("scans").select("id").eq("tier", "A").eq("status", "running").lt("created_at", new Date(Date.now() - 3 * 60_000).toISOString()).limit(50);
  for (const s of stale ?? []) {
    await db.from("scan_results").update({ status: "unavailable", error: "interrupted", finished_at: new Date().toISOString() }).eq("scan_id", s.id).eq("status", "pending");
    await finalize(db, s.id, { progressive: false });
  }
  return { deep: deep?.length ?? 0, closed, stale: stale?.length ?? 0 };
}

/* ------------------------------------------------------------------ fold */

/**
 * Recomputes the score from the stored base reasons plus all intel so far
 * (tier A and any tier B child). Progressive calls update the live score only;
 * the final call also closes the scan and applies the outcome.
 */
export async function finalize(db: AdminClient, scanId: string, opts: { progressive: boolean }) {
  const { data: scan } = await db.from("scans").select("*").eq("id", scanId).single();
  if (!scan) return;
  const { data: children } = await db.from("scans").select("id").eq("parent_scan_id", scanId);
  const ids = [scanId, ...(children ?? []).map((c) => c.id)];
  const [{ data: rows }, { data: subs }] = await Promise.all([
    db.from("scan_results").select("provider, status, verdict, malicious_count, total_count, summary").in("scan_id", ids),
    db.from("intel_subdomains").select("subdomain, verdict, brand_token").eq("scan_id", scanId),
  ]);
  const results: ProviderResult[] = (rows ?? [])
    .filter((r) => r.provider !== "internal")
    .map((r) => ({ provider: r.provider as IntelProviderName, status: r.status === "pending" ? "skipped" : (r.status as ProviderResult["status"]), verdict: r.verdict, maliciousCount: r.malicious_count ?? undefined, totalCount: r.total_count ?? undefined, summary: r.summary as Record<string, unknown> }));

  // Base reasons and score from the report or check this scan belongs to.
  let baseReasons: Reason[] = [];
  let thresholds = DEFAULT_THRESHOLDS;
  if (scan.report_id) baseReasons = ((await db.from("reports").select("reasons").eq("id", scan.report_id).maybeSingle()).data?.reasons as unknown as Reason[]) ?? [];
  else if (scan.check_id) baseReasons = ((await db.from("checks").select("reasons").eq("id", scan.check_id).maybeSingle()).data?.reasons as unknown as Reason[]) ?? [];
  const settings = (await db.from("settings").select("value").eq("key", "thresholds").maybeSingle()).data?.value as typeof DEFAULT_THRESHOLDS | undefined;
  if (settings) thresholds = { ...DEFAULT_THRESHOLDS, ...settings };

  // Domain age: RDAP, then VirusTotal creation_date, then the domains table.
  const rdap = results.find((r) => r.provider === "rdap" && r.status === "done")?.summary as { registeredAt?: string; expiresAt?: string; privacy?: boolean; registrar?: string } | undefined;
  const vt = results.find((r) => r.provider === "virustotal" && r.status === "done" && !(r.summary as { deep?: boolean }).deep)?.summary as { creationDate?: string } | undefined;
  const crt = results.find((r) => r.provider === "crtsh" && r.status === "done")?.summary as { firstCertAt?: string } | undefined;
  const { data: known } = await db.from("domains").select("registered_at, first_seen_at, registrar").eq("domain", scan.registrable_domain).maybeSingle();
  const registeredAt = rdap?.registeredAt ?? vt?.creationDate ?? known?.registered_at ?? null;
  const registrar = (rdap?.registrar ?? known?.registrar ?? "").toLowerCase();
  let riskyInfra = false;
  if (registrar) {
    const { data: infra } = await db.from("campaign_domains").select("domains(registrar), campaigns!inner(status)").in("campaigns.status", ["confirmed", "takedown_in_progress", "resolved"]).limit(2000);
    riskyInfra = (infra ?? []).some((i) => (i.domains as { registrar: string | null } | null)?.registrar?.toLowerCase() === registrar);
  }
  const lifetime = lifetimeReasons({ domain: scan.registrable_domain, registeredAt, expiresAt: rdap?.expiresAt, privacy: rdap?.privacy, firstCertAt: crt?.firstCertAt, firstReportAt: known?.first_seen_at, riskyInfra });
  const officialSet = new Set((await loadContext()).officialDomains.keys());
  const subReasons = subdomainReasons(scan.registrable_domain, (subs ?? []).map((s) => ({ name: s.subdomain, brandToken: s.brand_token })), officialSet.has(scan.registrable_domain));
  const verdicts = intelVerdictReasons(results, (subs ?? []).map((s) => ({ subdomain: s.subdomain, verdict: s.verdict })), scan.registrable_domain);

  const baseScore = scan.base_score ?? 0;
  const folded = foldIntel({ baseScore, baseReasons, intelReasons: [...lifetime.reasons, ...subReasons, ...verdicts.reasons], floor: verdicts.floor, thresholds });
  const verdict = verdicts.floor === 80 ? "malicious" : verdicts.floor === 40 ? "suspicious" : results.some((r) => r.status === "done" && r.verdict === "clean") ? "clean" : "unknown";

  await db.from("scans").update({
    score_delta: folded.delta,
    final_score: folded.score,
    verdict,
    domain_age_days: lifetime.ageDays,
    registered_at: registeredAt,
    ...(opts.progressive || scan.tier === "B" ? {} : { status: "done", finished_at: new Date().toISOString() }),
  }).eq("id", scanId);

  if (opts.progressive) return;

  // Apply to the report/check only when intel raised the score.
  if (folded.delta > 0) {
    const patch = { score: folded.score, flag: folded.flag, reasons: folded.reasons as unknown as Json };
    if (scan.report_id) await db.from("reports").update(patch).eq("id", scan.report_id).lt("score", folded.score);
    if (scan.check_id) await db.from("checks").update(patch).eq("id", scan.check_id).lt("score", folded.score);
  }

  // Confirmed by intel: record the domain and IoC, link to the report's campaign.
  if (verdict === "malicious") await recordConfirmed(db, scan, registeredAt, lifetime.ageDays);
}

async function recordConfirmed(db: AdminClient, scan: { registrable_domain: string; report_id: string | null; check_id: string | null }, registeredAt: string | null, ageDays: number | null) {
  const { data: existing } = await db.from("domains").select("id, status").eq("domain", scan.registrable_domain).maybeSingle();
  const domainId = existing
    ? existing.id
    : (await db.from("domains").insert({ domain: scan.registrable_domain, status: "threat", registered_at: registeredAt, age_days: ageDays, risk_score: 90 }).select("id").single()).data?.id;
  if (existing && existing.status === "watching") await db.from("domains").update({ status: "threat" }).eq("id", existing.id);
  let campaignId: string | null = null;
  if (scan.report_id) campaignId = (await db.from("reports").select("campaign_id").eq("id", scan.report_id).maybeSingle()).data?.campaign_id ?? null;
  else if (scan.check_id) campaignId = (await db.from("checks").select("campaign_id").eq("id", scan.check_id).maybeSingle()).data?.campaign_id ?? null;
  await db.from("iocs").upsert({ type: "domain", value: defang(scan.registrable_domain), campaign_id: campaignId, source: "intel", last_seen: new Date().toISOString() }, { onConflict: "type,value" });
  if (campaignId && domainId) await db.from("campaign_domains").upsert({ campaign_id: campaignId, domain_id: domainId }, { onConflict: "campaign_id,domain_id", ignoreDuplicates: true });
  revalidateTag("detection", "max");
}
