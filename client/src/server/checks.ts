import "server-only";

import type { Json } from "@/types/database";
import type { AnalysisInputDto } from "@/lib/schemas/analysis";
import { analyze } from "./detection";
import { fillMissingDomainAges, submittedHosts } from "./detection/domain-age";
import { explain } from "./detection/explain";
import { reviewWithGemini } from "./detection/gemini-review";
import { loadContext } from "./detection/load-context";
import { extractUrls, normalizePhone, refang } from "./detection/normalize";
import { groupCandidates, type CampaignGroup } from "./detection/pattern";
import { maskText } from "./detection/masks";
import type { ScreenshotContext } from "./detection/screenshot";
import { PATTERN, type PatternMatch } from "./detection";
import { supabaseCampaignRepo } from "./campaign-repo";
import { isReportable } from "@/lib/flags";
import type { Enums } from "@/types/database";
import { candidateFromStored } from "./detection/stored-features";
import type { AnalysisResult, CheckFeatures } from "./detection/types";
import { tryAdmin, type AdminClient } from "./db";
import { startLiveScan } from "./intel/orchestrator";
import { registrableDomain } from "./intel/sanitize";
import { hashInput, type HashKind } from "./hash";
import { generateText } from "./llm";
import { recomputeSafetyScore } from "./badges";

/** The campaign a scan matched, as shown to the citizen. No reporter or message data. */
export interface ScanCampaign {
  code: string;
  name: string | null;
  tactic: string;
  status: Enums<"campaign_status">;
  severity: Enums<"severity">;
  messageCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  /** "known": a link, domain or number is already linked to it. "similar": the text follows its pattern. */
  matchType: "known" | "similar";
  /** 0–1: 1 for an exact indicator match, the text similarity otherwise. */
  confidence: number;
  /** Public campaign page (/threats/[code]) when the campaign is in the public feed. */
  isPublic: boolean;
}

/** What the scan read the input as. */
export interface ScanDetected {
  kind: "email" | "message" | "link" | "phone" | "qr";
  sender: string | null;
  subject: string | null;
  /** Set when the input was a screenshot: what image recognition read from it. */
  screenshot?: ScreenshotContext;
}

export interface CheckOutcome {
  result: AnalysisResult;
  campaign: ScanCampaign | null;
  detected: ScanDetected;
  /** True when the score is in the suspicious band or above (see REPORTABLE_FLAGS). */
  canReport: boolean;
  checkId: string | null;
  explanation: { text: string; source: "llm" | "template" };
  /** Live threat-intelligence scan of the first URL, streamed by the page. */
  scan: { scanId: string; token: string } | null;
  /** One live scan per distinct registrable domain (up to opts.liveScans); scans[0] === scan. */
  scans: { scanId: string; token: string; host: string }[];
}

/** Fingerprint of what was checked: never the text itself (SPEC 7). */
export function fingerprint(input: AnalysisInputDto): { kind: "url" | "text" | "phone" | "qr" | "email_signals"; hash: string } {
  const first = input.urls?.[0];
  const pick = (k: HashKind, v: string) => hashInput(k, v);
  switch (input.kind) {
    case "url":
      return { kind: "url", hash: pick("url", refang(first ?? input.text ?? "")) };
    case "qr":
      return { kind: "qr", hash: pick("url", refang(first ?? input.text ?? "")) };
    case "phone":
      return { kind: "phone", hash: pick("phone", normalizePhone(input.text ?? input.sender ?? "")) };
    case "email_signals":
      return { kind: "email_signals", hash: pick("text", [input.sender, input.subject, input.text].filter(Boolean).join("\n")) };
    default:
      return { kind: "text", hash: pick("text", input.text ?? "") };
  }
}

/** Pattern lookups that take longer than this are skipped: a scan never waits on them. */
const PATTERN_TIMEOUT_MS = 2500;

/** Trigram similarity of the masked text against campaign messages of the last 180 days. */
function patternLookup(db: AdminClient): (text: string) => Promise<PatternMatch | null> {
  const repo = supabaseCampaignRepo(db);
  return async (text) => {
    const masked = maskText(text).slice(0, 4000);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PATTERN_TIMEOUT_MS));
    const hit = await Promise.race([repo.findSimilarBody(masked, 0.45, 180), timeout]);
    return hit ? { id: hit.id, code: hit.code, status: hit.status, similarity: hit.similarity } : null;
  };
}

async function loadScanCampaign(db: AdminClient, match: NonNullable<AnalysisResult["campaign"]>): Promise<ScanCampaign | null> {
  if (!match.id || match.matchType === "new_candidate") return null;
  const { data: c } = await db
    .from("campaigns")
    .select("code, tactic, status, severity, message_count, first_seen, last_seen, is_public, imitated_name, institutions(name)")
    .eq("id", match.id)
    .maybeSingle();
  if (!c) return null;
  return {
    code: c.code,
    name: (c.institutions as { name: string } | null)?.name ?? c.imitated_name,
    tactic: c.tactic,
    status: c.status,
    severity: c.severity,
    messageCount: c.message_count,
    firstSeen: c.first_seen,
    lastSeen: c.last_seen,
    matchType: match.matchType,
    confidence: match.confidence,
    isPublic: c.is_public && c.status !== "monitoring",
  };
}

/** How many recent feature rows a new check may be compared with. */
const RECENT_FEATURE_CHECKS = 40;

export interface FeatureOverlap {
  reason: "shared_exfil" | "shared_url" | "shared_domain";
  evidence: string;
}

function overlapOf(group: CampaignGroup): FeatureOverlap | null {
  switch (group.reason) {
    case "shared_exfil":
    case "shared_url":
    case "shared_domain":
      return { reason: group.reason, evidence: group.evidence };
    case "similar_text":
      return null;
    default: {
      const unexpected: never = group.reason;
      return unexpected;
    }
  }
}

/**
 * Compare this check with a small set of recent rows using stored features only.
 * Message bodies are not loaded, so text shingles are never applied.
 * The result does not change campaign_id.
 */
async function findFeatureOverlap(db: AdminClient, features: CheckFeatures): Promise<FeatureOverlap | null> {
  const current = candidateFromStored(features);
  if (!current) return null;
  const { data } = await db
    .from("checks")
    .select("features")
    .not("features", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_FEATURE_CHECKS);
  for (const row of data ?? []) {
    const previous = candidateFromStored(row.features);
    if (!previous) continue;
    const group = groupCandidates(current, previous);
    if (!group) continue;
    const overlap = overlapOf(group);
    if (overlap) return overlap;
  }
  return null;
}

/**
 * Analyse and store a hash-only check row (SPEC 13.2 /scan). The input text is
 * never stored. Optionally links the check to a signed-in citizen who turned
 * on "save my history".
 */
export async function runCheck(
  input: AnalysisInputDto,
  opts: { linkUserId?: string | null; explainWithLlm?: boolean; liveScans?: number; deep?: boolean; detected?: ScanDetected } = {},
): Promise<CheckOutcome> {
  const ctx = await loadContext();
  await fillMissingDomainAges(ctx, submittedHosts(input));
  const fp = fingerprint(input);
  const db = tryAdmin();
  const result = await analyze(input, ctx, {
    gemini: (body, linkHosts) => reviewWithGemini(body, generateText, `detect:${fp.hash}`, linkHosts),
    patternMatch: db ? patternLookup(db) : undefined,
  });
  const campaign = db && result.campaign ? await loadScanCampaign(db, result.campaign) : null;

  let checkId: string | null = null;
  if (db) {
    const featureOverlap = await findFeatureOverlap(db, result.features);
    const { data } = await db
      .from("checks")
      .insert({
        input_kind: fp.kind,
        input_hash: fp.hash,
        score: result.score,
        flag: result.flag,
        reasons: result.reasons as unknown as Json,
        // Shown matches start at PATTERN.show; only exact or strong pattern matches are stored as links.
        campaign_id: result.campaign && (result.campaign.matchType === "known" || result.campaign.confidence >= PATTERN.signal) ? (result.campaign.id ?? null) : null,
        model_version: result.modelVersion,
        features: { ...result.features, featureOverlap } as unknown as Json,
        scam_type: result.classification.scamType,
        impersonated_brand: result.classification.impersonatedBrand,
        confidence: result.classification.confidence,
      })
      .select("id")
      .single();
    checkId = data?.id ?? null;

    if (checkId && opts.linkUserId) {
      await db.from("user_check_links").insert({ user_id: opts.linkUserId, check_id: checkId, kind: fp.kind });
      await recomputeSafetyScore(db, opts.linkUserId);
    }
  }

  // Live threat intelligence: one scan per distinct domain, first URL first.
  const scans: CheckOutcome["scans"] = [];
  if (checkId) {
    const candidates = [...(input.urls ?? []), ...(input.text ? extractUrls(input.text) : [])];
    const seen = new Set<string>();
    for (const url of candidates) {
      if (scans.length >= Math.max(1, opts.liveScans ?? 1)) break;
      let host: string;
      try {
        host = new URL(refang(url)).hostname.toLowerCase();
      } catch {
        continue;
      }
      const domain = registrableDomain(host);
      if (seen.has(domain)) continue;
      seen.add(domain);
      const started = await startLiveScan({ url, checkId, deep: opts.deep === true, requestedBy: opts.linkUserId ?? null });
      if (started.ok) scans.push({ scanId: started.scanId, token: started.token, host: host.replace(/\./g, "[.]") });
    }
  }
  const scan: CheckOutcome["scan"] = scans[0] ? { scanId: scans[0].scanId, token: scans[0].token } : null;

  const explanation = await explain(result, input.locale, {
    generate: opts.explainWithLlm ? generateText : undefined,
    inputHash: fp.hash,
  });
  const detected: ScanDetected = opts.detected ?? {
    kind: input.kind === "url" ? "link" : input.kind === "phone" ? "phone" : input.kind === "qr" ? "qr" : input.channel === "email" ? "email" : "message",
    sender: input.sender ?? null,
    subject: input.subject ?? null,
  };
  return { result, campaign, detected, canReport: isReportable(result.flag), checkId, explanation, scan, scans };
}
