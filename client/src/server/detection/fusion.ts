import { flagForScore, type Thresholds } from "@/lib/flags";
import { GROUP_CAPS, type AnalysisResult, type Reason, type ReasonGroup } from "./types";

export interface FusionOptions {
  thresholds: Thresholds;
  /** Input matched a confirmed campaign IoC or blocklist entry → score ≥ 80. */
  floor: boolean;
  /** Official sender with passing auth (or exact SMS sender) → score ≤ 19. */
  cap: boolean;
  /** False when nothing could be analysed → grey, never green. */
  analysed: boolean;
}

export const FLOOR_SCORE = 80;
export const CAP_SCORE = 19;
export const MAX_REASONS = 8;

/**
 * Combine reasons into the 0-100 score (SPEC 6.3). Each group is capped; the
 * floor rule is applied last so a blocklisted indicator always wins.
 */
export function fuse(
  reasons: Reason[],
  opts: FusionOptions,
): Pick<AnalysisResult, "score" | "flag" | "groups" | "reasons"> {
  const groups: Record<ReasonGroup, number> = { links: 0, content: 0, sender: 0, attachments: 0, reputation: 0 };
  for (const r of reasons) groups[r.group] += r.weight;
  for (const g of Object.keys(groups) as ReasonGroup[]) {
    groups[g] = Math.round(Math.min(GROUP_CAPS[g], Math.max(0, groups[g])) * 10) / 10;
  }

  const sorted = [...reasons].sort((a, b) => b.weight - a.weight).slice(0, MAX_REASONS);

  if (!opts.analysed) {
    return { score: 0, flag: "grey", groups, reasons: sorted };
  }

  let score = Math.round(Object.values(groups).reduce((a, b) => a + b, 0));
  if (opts.cap) score = Math.min(score, CAP_SCORE);
  if (opts.floor) score = Math.max(score, FLOOR_SCORE);
  score = Math.max(0, Math.min(100, score));

  return { score, flag: flagForScore(score, opts.thresholds), groups, reasons: sorted };
}
