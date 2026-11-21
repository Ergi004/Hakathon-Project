import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  summarizePatternChecks,
  type PatternCheck,
  type PatternDrill,
  type PatternKind,
  type PatternReport,
  type PatternWindow,
} from "./pattern-summary";

const DAY = 86_400_000;
const CHECK_LIMIT = 5000;

function oneCampaign(value: { id: string; code: string } | { id: string; code: string }[] | null): PatternCheck["campaign"] {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row?.id || !row.code) return null;
  return { id: row.id, code: row.code };
}

/** Classified checks for the pattern explorer. The window is applied in the database; drill-down filters are applied in memory. */
export async function getPatternExplorer(
  db: SupabaseClient<Database>,
  input: { days: PatternWindow; kind?: PatternKind } & PatternDrill,
): Promise<PatternReport> {
  const since = new Date(Date.now() - input.days * DAY).toISOString();
  let query = db
    .from("checks")
    .select("created_at, scam_type, impersonated_brand, confidence, features, campaigns(id, code)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(CHECK_LIMIT);
  if (input.kind) query = query.eq("input_kind", input.kind);
  const { data } = await query;
  const rows: PatternCheck[] = (data ?? []).map((row) => ({
    createdAt: row.created_at,
    scamType: row.scam_type,
    brand: row.impersonated_brand,
    confidence: row.confidence,
    features: row.features,
    campaign: oneCampaign(row.campaigns),
  }));
  return summarizePatternChecks(rows, input);
}
