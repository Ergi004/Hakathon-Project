import "server-only";

import type { ScanOptions, ScanRequest } from "@/lib/schemas/phishing-intel";
import type { AdminClient } from "@/server/db";
import { analyze } from "@/server/detection";
import { scoreDomain } from "@/server/detection/domain-score";
import { loadContext } from "@/server/detection/load-context";
import { maskText } from "@/server/detection/masks";
import type { AnalysisInput } from "@/server/detection/types";
import { sha256 } from "@/server/hash";
import type { Json } from "@/types/database";
import { PROMPT_VERSION, runAi, type AiRun } from "./ai/orchestrator";
import { correlateAndAttribute } from "./attribution/attribution";
import { attribute } from "./attribution/confidence-engine";
import { parseEmail } from "./channels/email/email-parser";
import { parseSms, type SmsSender } from "./channels/sms/sms-analyzer";
import { classify } from "./detection/classifier";
import { extractIocs } from "./intelligence/ioc-extractor";
import { mapTechniques } from "./intelligence/mitre-mapper";
import { lookupReputation, type ReputationOutcome } from "./intelligence/virustotal/reputation";
import type { Owner } from "./principal";
import { albaniaSignals, type AlbaniaSignal } from "./albania";
import { buildReport } from "./reporting/report-builder";
import { components, finalRisk, severityOf, verdictConfidence, verdictOf, weightedRisk } from "./scoring";
import { STAGES, type AttributionResult, type Classification, type ParsedMessage, type Stage, type Stages, type StageStatus } from "./types";

export type Message = ParsedMessage & { smsSender?: SmsSender };

const MAX_ATTEMPTS = 3;
const STORED_TEXT = 20_000;

export async function parseRequest(req: ScanRequest): Promise<Message> {
  if (req.channel === "EMAIL") return parseEmail(req.email, req.source, req.options.locale);
  return parseSms(req.message, req.source, req.options.locale);
}

/** What is persisted for retries: masked text, no attachment bytes, no raw headers (hard rule 5, PDF §5 retention). */
export function toStoredInput(m: Message): Json {
  return {
    channel: m.channel,
    source: m.source,
    subject: m.subject ? maskText(m.subject) : null,
    sender: m.sender ?? null,
    replyTo: m.replyTo ?? null,
    returnPath: m.returnPath ?? null,
    text: maskText(m.text).slice(0, STORED_TEXT),
    hrefs: m.hrefs.slice(0, 200).map((h) => ({ href: h.href, display: maskText(h.display).slice(0, 200) })),
    attachments: m.attachments.map((a) => ({ name: a.name, mime: a.mime, size: a.size, sha256: a.sha256 ?? null, detectedType: a.detectedType ?? null })),
    auth: { ...m.auth },
    headerFindings: m.headerFindings.map((f) => ({ ...f, evidence: f.evidence ?? null })),
    // Redacted endpoints only (no tokens), so a retry keeps the data-destination findings.
    exfil: m.exfil,
    receivedAt: m.receivedAt ?? null,
    locale: m.locale,
    smsSender: m.smsSender ? { ...m.smsSender } : null,
  } as unknown as Json;
}

function fromStoredInput(j: Json): Message {
  const s = j as unknown as Record<string, unknown> & Message;
  return {
    ...s,
    subject: s.subject ?? undefined,
    sender: s.sender ?? undefined,
    replyTo: s.replyTo ?? undefined,
    returnPath: s.returnPath ?? undefined,
    receivedAt: s.receivedAt ?? undefined,
    attachments: (s.attachments ?? []).map((a) => ({ ...a, sha256: a.sha256 ?? undefined, detectedType: a.detectedType ?? undefined })),
    headerFindings: (s.headerFindings ?? []).map((f) => ({ ...f, evidence: f.evidence ?? undefined })),
    smsSender: s.smsSender ?? undefined,
    exfil: s.exfil ?? [],
  };
}

function albaniaColumns(signals: AlbaniaSignal[]) {
  return { albania: signals.length > 0, albania_signals: signals };
}

export function idempotencyKey(m: Message, header?: string | null): string {
  if (header && /^[\w.:-]{8,128}$/.test(header)) return `h:${header}`;
  return `c:${sha256(
    [m.channel, m.subject, m.sender, m.text.slice(0, 50_000), ...m.hrefs.map((h) => h.href), ...m.attachments.map((a) => a.sha256 ?? a.name)].join("\u0000"),
  )}`;
}

/** Creates (or returns the existing, idempotent) scan row. */
export async function createScan(db: AdminClient, owner: Owner, req: ScanRequest, msg: Message, idemHeader?: string | null) {
  const key = idempotencyKey(msg, idemHeader);
  const { data: existing } = await db.from("phishing_scans").select("id, status").eq("owner_key", owner.key).eq("idempotency_key", key).maybeSingle();
  if (existing) return { id: existing.id, status: existing.status, duplicate: true };

  const stages = Object.fromEntries(STAGES.map((s) => [s, "pending"])) as Stages;
  const { data, error } = await db
    .from("phishing_scans")
    .insert({
      owner_key: owner.key,
      owner_user_id: owner.userId,
      owner_org_id: owner.orgId,
      owner_install_id: owner.installId,
      idempotency_key: key,
      channel: msg.channel,
      source: msg.source,
      input: toStoredInput(msg),
      options: req.options as unknown as Json,
      stages: stages as unknown as Json,
      // Early Albania scope so the SOC filter works while the scan is still running.
      ...albaniaColumns(albaniaSignals(msg, extractIocs(msg))),
    })
    .select("id, status")
    .single();
  if (error || !data) {
    // Lost a race on the unique key: return the winner.
    const { data: again } = await db.from("phishing_scans").select("id, status").eq("owner_key", owner.key).eq("idempotency_key", key).maybeSingle();
    if (again) return { id: again.id, status: again.status, duplicate: true };
    throw new Error("scan_insert_failed");
  }
  await db.from("scan_events").insert({ scan_id: data.id, stage: "queue", status: "queued" });
  return { id: data.id, status: data.status, duplicate: false };
}

function toAnalysisInput(m: Message, locale: "sq" | "en"): AnalysisInput {
  const auth = m.auth.source === "absent" ? undefined : m.auth;
  const map = (v?: string) => (v === "pass" ? "pass" : v === "fail" || v === "softfail" ? "fail" : "none") as "pass" | "fail" | "none";
  return {
    kind: m.channel === "email" ? "email_signals" : "text",
    channel: m.channel === "email" ? "email" : "sms",
    text: m.text.slice(0, 10_000),
    subject: m.subject?.slice(0, 500),
    sender: m.sender?.slice(0, 320),
    urls: [...new Set(m.hrefs.map((h) => h.href))].slice(0, 50),
    headers: { spf: auth ? map(auth.spf) : undefined, dkim: auth ? map(auth.dkim) : undefined, dmarc: auth ? map(auth.dmarc) : undefined, replyTo: m.replyTo },
    attachments: m.attachments.slice(0, 20).map((a) => ({ name: a.name, mime: a.mime, size: a.size })),
    locale,
  };
}

/**
 * Runs the pipeline for one scan (PDF §2.1, §10 P1-P6). Safe to call from
 * after(), the retry endpoint and the cron sweeper: the atomic claim makes sure
 * only one worker processes a scan. `live` is the in-memory parsed message from
 * the request; retries fall back to the minimised stored input.
 */
export async function processScan(db: AdminClient, scanId: string, live?: Message): Promise<void> {
  const { data: row } = await db.from("phishing_scans").select("id, attempts, input, options, status").eq("id", scanId).maybeSingle();
  if (!row || row.status !== "queued" || row.attempts >= MAX_ATTEMPTS) return;
  const { data: claimed } = await db
    .from("phishing_scans")
    .update({ status: "processing", attempts: row.attempts + 1, started_at: new Date().toISOString(), error: null })
    .eq("id", scanId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const options = row.options as unknown as ScanOptions;
  const stages = Object.fromEntries(STAGES.map((s) => [s, "pending"])) as Stages;
  let done = 0;
  const set = async (stage: Stage, status: StageStatus, message?: string) => {
    stages[stage] = status;
    if (status !== "running") done += 1;
    await db.from("phishing_scans").update({ stages: stages as unknown as Json, progress: Math.round((done / STAGES.length) * 100) }).eq("id", scanId);
    await db.from("scan_events").insert({ scan_id: scanId, stage, status, message: message?.slice(0, 500) ?? null });
  };

  try {
    // P1 parsing + IOC extraction
    const msg = live ?? fromStoredInput(row.input);
    await set("parsing", "completed", live ? "parsed from request" : "re-parsed from stored, minimised input");
    const iocs = extractIocs(msg);
    if (iocs.length) {
      await db.from("scan_iocs").upsert(
        iocs.map((i) => ({
          scan_id: scanId,
          type: i.type,
          value: i.display,
          normalized_value: i.normalized,
          location: i.locations.join(","),
          subtype: i.subtype ?? null,
          detail: (i.detail ?? {}) as Json,
        })),
        { onConflict: "scan_id,type,normalized_value", ignoreDuplicates: true },
      );
    }
    const exfilCount = iocs.filter((i) => i.type === "exfil_endpoint").length;
    await set("iocExtraction", "completed", `${iocs.length} indicator(s)${exfilCount ? `, ${exfilCount} data destination(s)` : ""}`);
    const exfilRelated = await relatedExfil(db, scanId, msg.exfil);

    // P3 deterministic heuristics (core Mburoja engine + channel findings)
    const ctx = await loadContext();
    const engine = await analyze(toAnalysisInput(msg, options.locale), ctx);
    const findings = msg.headerFindings;
    const officialHosts = new Set(iocs.filter((i) => i.type === "domain" && scoreDomain(i.normalized, ctx).official).map((i) => i.normalized));
    await set("heuristics", "completed", `engine score ${engine.score}`);

    // P2 reputation
    let rep: ReputationOutcome | null = null;
    if (options.useVirusTotal) {
      await set("virusTotal", "running");
      rep = await lookupReputation(db, iocs, officialHosts);
      await set("virusTotal", rep.status, rep.note ?? `${rep.reputations.length} result(s)`);
    } else await set("virusTotal", "skipped", "disabled by request");

    const urls = iocs.filter((i) => i.type === "url").map((i) => i.normalized);
    const rules = classify({ msg, engine, findings, reputations: rep?.reputations ?? [], urls });

    const comps = components({
      channel: msg.channel,
      engine,
      findings,
      auth: msg.auth,
      reputations: rep?.reputations ?? [],
      vtAvailable: rep?.status === "completed" || rep?.status === "partial",
      hasUrls: urls.length > 0,
      hasAttachments: msg.attachments.length > 0,
    });
    const { score: weighted, unavailable } = weightedRisk(comps);
    const risk = finalRisk(weighted, engine, rep?.reputations ?? [], findings);
    const analysable = Boolean(msg.text.trim() || msg.subject || urls.length || msg.attachments.length);
    const verdict = verdictOf(risk, analysable, { flag: engine.flag, phishingTypes: rules.filter((c) => c.dimension === "phishing_type").length });

    // P4 AI (advisory; cannot change risk or verdict)
    let ai: AiRun | null = null;
    await set("aiAnalysis", "running");
    try {
      ai = await runAi({ text: msg.text, subject: msg.subject, channel: msg.channel, signals: [...engine.reasons.map((r) => r.code), ...findings.map((f) => f.code)], risk, options });
      for (const c of ai.calls) {
        await db.from("ai_analysis_logs").insert({
          scan_id: scanId,
          provider: c.provider,
          model: c.model,
          prompt_version: PROMPT_VERSION,
          policy: ai.policy,
          status: c.validation === "ok" ? "ok" : c.status === "ok" ? "invalid" : c.status,
          latency_ms: c.latencyMs,
          tokens: c.tokens,
        });
      }
      await set("aiAnalysis", ai.status === "completed" ? "completed" : ai.status === "skipped" ? "skipped" : "partial", ai.note ?? ai.policy);
    } catch {
      await set("aiAnalysis", "partial", "AI analysis failed; rules-based result only");
    }
    const classifications: Classification[] = [...rules];
    const aiType = ai?.output?.suggestedPhishingType;
    if (aiType && verdict !== "clean" && !rules.some((c) => c.dimension === "phishing_type" && c.value === aiType)) {
      classifications.push({ dimension: "phishing_type", value: aiType, confidence: Math.min(0.5, ai!.output!.confidence), evidence: ai!.output!.evidence.map((e) => `Quoted: "${e.quote}"`), source: "ai" });
    }

    // P5 correlation + attribution
    let attribution: AttributionResult;
    if (options.threatAttribution) {
      await set("attribution", "running");
      try {
        attribution = await correlateAndAttribute(db, iocs, engine);
        await set("attribution", "completed", attribution.status);
      } catch {
        attribution = attribute(null, []);
        await set("attribution", "partial", "correlation unavailable");
      }
    } else {
      attribution = attribute(null, []);
      await set("attribution", "skipped", "disabled by request");
    }

    const techniques = mapTechniques({ msg, classifications, findings, reasonCodes: engine.reasons.map((r) => r.code), urlCount: urls.length, verdictIsBenign: verdict === "clean" || verdict === "unknown" });
    const evidenceCount = engine.reasons.filter((r) => r.weight > 0).length + findings.length + (rep?.reputations.filter((r) => r.malicious > 0).length ?? 0);
    const confidence = verdictConfidence(comps, evidenceCount);
    const severity = severityOf(risk);

    // P6 report
    stages.report = "completed";
    const generatedAt = new Date().toISOString();
    const report = buildReport({ scanId, msg, iocs, engine, findings, rep, classifications, techniques, attribution, ai, components: comps, unavailable, risk, severity, verdict, confidence, stages, generatedAt, exfilRelated });

    if (classifications.length) {
      await db.from("phishing_classifications").delete().eq("scan_id", scanId);
      await db.from("phishing_classifications").insert(classifications.map((c) => ({ scan_id: scanId, dimension: c.dimension, value: c.value, confidence: c.confidence, evidence: c.evidence, source: c.source })));
    }
    if (techniques.length) {
      await db.from("scan_techniques").upsert(techniques.map((t) => ({ scan_id: scanId, technique_id: t.id, name: t.name, tactic: t.tactic, observation: t.observation })), { onConflict: "scan_id,technique_id" });
    }
    await db.from("scan_reports").upsert({ scan_id: scanId, channel: msg.channel, report: report as unknown as Json }, { onConflict: "scan_id" });
    await db.from("scan_events").insert({ scan_id: scanId, stage: "report", status: "completed" });

    const partial = Object.values(stages).some((s) => s === "partial" || s === "failed");
    const top = (d: Classification["dimension"]) => classifications.filter((c) => c.dimension === d).sort((a, b) => b.confidence - a.confidence)[0]?.value ?? null;
    await db
      .from("phishing_scans")
      .update({
        status: partial ? "partial" : "completed",
        verdict,
        risk_score: risk,
        severity,
        confidence,
        phishing_type: top("phishing_type"),
        phishing_family: top("phishing_family"),
        malware_family: top("malware_family"),
        campaign_id: attribution.campaign?.id ?? null,
        threat_actor_id: attribution.actor?.id ?? null,
        attribution_status: attribution.status,
        ...albaniaColumns(albaniaSignals(msg, iocs, Boolean(engine.matchedInstitution))),
        vt_max_malicious: rep?.reputations.length ? Math.max(...rep.reputations.map((r) => r.malicious)) : null,
        stages: stages as unknown as Json,
        progress: 100,
        completed_at: generatedAt,
      })
      .eq("id", scanId);
  } catch (e) {
    console.error("phishing scan failed", scanId, e instanceof Error ? e.message : e);
    for (const s of STAGES) if (stages[s] === "pending" || stages[s] === "running") stages[s] = "failed";
    await db.from("phishing_scans").update({ status: "failed", error: "processing_error", stages: stages as unknown as Json }).eq("id", scanId);
    await db.from("scan_events").insert({ scan_id: scanId, stage: "pipeline", status: "failed", message: "processing_error" });
  }
}

/**
 * Other scans whose captured data goes to the same place (same bot, webhook or
 * handler). One operator often runs many lures; the endpoint ties them together.
 */
export async function relatedExfil(db: AdminClient, scanId: string, exfil: Message["exfil"]): Promise<Record<string, { scans: number; latest: string[] }>> {
  const keys = [...new Set((exfil ?? []).map((e) => e.key))].slice(0, 50);
  if (!keys.length) return {};
  const { data } = await db
    .from("scan_iocs")
    .select("normalized_value, scan_id, created_at")
    .eq("type", "exfil_endpoint")
    .in("normalized_value", keys)
    .neq("scan_id", scanId)
    .order("created_at", { ascending: false })
    .limit(500);
  const out: Record<string, { scans: number; latest: string[] }> = {};
  for (const row of data ?? []) {
    const entry = (out[row.normalized_value] ??= { scans: 0, latest: [] });
    if (entry.latest.includes(row.scan_id)) continue;
    entry.scans += 1;
    if (entry.latest.length < 5) entry.latest.push(row.scan_id);
  }
  return out;
}

/** Retry an eligible failed or partial scan (PDF §6 POST /scans/:id/retry). */
export async function requeue(db: AdminClient, scanId: string): Promise<"queued" | "not_eligible" | "exhausted"> {
  const { data } = await db.from("phishing_scans").select("status, attempts").eq("id", scanId).maybeSingle();
  if (!data || !["failed", "partial"].includes(data.status)) return "not_eligible";
  if (data.attempts >= MAX_ATTEMPTS) return "exhausted";
  const { data: ok } = await db.from("phishing_scans").update({ status: "queued" }).eq("id", scanId).in("status", ["failed", "partial"]).select("id").maybeSingle();
  if (ok) await db.from("scan_events").insert({ scan_id: scanId, stage: "queue", status: "requeued" });
  return ok ? "queued" : "not_eligible";
}

/** Cron sweeper: queued scans nobody picked up, and scans stuck in processing (crashed worker). */
export async function sweepScans(db: AdminClient) {
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: stuck } = await db.from("phishing_scans").update({ status: "queued" }).eq("status", "processing").lt("updated_at", stale).lt("attempts", MAX_ATTEMPTS).select("id");
  await db.from("phishing_scans").update({ status: "failed", error: "max_attempts" }).eq("status", "processing").lt("updated_at", stale).gte("attempts", MAX_ATTEMPTS);
  const waiting = new Date(Date.now() - 60_000).toISOString();
  const { data: queued } = await db.from("phishing_scans").select("id").eq("status", "queued").lt("updated_at", waiting).lt("attempts", MAX_ATTEMPTS).order("created_at").limit(10);
  let processed = 0;
  for (const s of queued ?? []) {
    await processScan(db, s.id);
    processed += 1;
  }
  return { requeuedStuck: stuck?.length ?? 0, processed };
}
