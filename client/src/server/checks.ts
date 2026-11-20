import "server-only";

import type { Json } from "@/types/database";
import type { AnalysisInputDto } from "@/lib/schemas/analysis";
import { analyze } from "./detection";
import { explain } from "./detection/explain";
import { loadContext } from "./detection/load-context";
import { normalizePhone, refang } from "./detection/normalize";
import type { AnalysisResult } from "./detection/types";
import { tryAdmin } from "./db";
import { hashInput, type HashKind } from "./hash";
import { generateText } from "./llm";

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
  const result = await analyze(input, ctx);
  const fp = fingerprint(input);

  let checkId: string | null = null;
  const db = tryAdmin();
  if (db) {
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
      })
      .select("id")
      .single();
    checkId = data?.id ?? null;

    if (checkId && opts.linkUserId) {
      await db.from("user_check_links").insert({ user_id: opts.linkUserId, check_id: checkId, kind: fp.kind });
    }
  }

  const explanation = await explain(result, input.locale, {
    generate: opts.explainWithLlm ? generateText : undefined,
    inputHash: fp.hash,
  });
  return { result, checkId, explanation };
}
