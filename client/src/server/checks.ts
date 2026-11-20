import "server-only";

import type { Json } from "@/types/database";
import type { AnalysisInputDto } from "@/lib/schemas/analysis";
import { analyze } from "./detection";
import { fillMissingDomainAges, submittedHosts } from "./detection/domain-age";
import { explain } from "./detection/explain";
import { reviewWithGemini } from "./detection/gemini-review";
import { loadContext } from "./detection/load-context";
import { normalizePhone, refang } from "./detection/normalize";
import { groupCandidates, type CampaignGroup } from "./detection/pattern";
import { candidateFromStored } from "./detection/stored-features";
import type { AnalysisResult, CheckFeatures } from "./detection/types";
import { tryAdmin, type AdminClient } from "./db";
import { hashInput, type HashKind } from "./hash";
import { generateText } from "./llm";
import { recomputeSafetyScore } from "./badges";

export interface CheckOutcome {
  result: AnalysisResult;
  checkId: string | null;
  explanation: { text: string; source: "llm" | "template" };
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
  opts: { linkUserId?: string | null; explainWithLlm?: boolean } = {},
): Promise<CheckOutcome> {
  const ctx = await loadContext();
  await fillMissingDomainAges(ctx, submittedHosts(input));
  const fp = fingerprint(input);
  const result = await analyze(input, ctx, {
    gemini: (body, linkHosts) => reviewWithGemini(body, generateText, `detect:${fp.hash}`, linkHosts),
  });

  let checkId: string | null = null;
  const db = tryAdmin();
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
        campaign_id: result.campaign?.id ?? null,
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

  const explanation = await explain(result, input.locale, {
    generate: opts.explainWithLlm ? generateText : undefined,
    inputHash: fp.hash,
  });
  return { result, checkId, explanation };
}
