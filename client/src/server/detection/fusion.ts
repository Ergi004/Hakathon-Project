import { flagForScore, type Thresholds } from "@/lib/flags";
import { SCORING, type GroupOverride } from "./scoring/config";
import { GROUP_CAPS, type AnalysisResult, type AppliedOverride, type Reason, type ReasonGroup } from "./types";

export interface FusionOptions {
  thresholds: Thresholds;
  /** Confirmed campaign IoC → the blocklist floor of 80. */
  floor: boolean;
  /** Blocklist listings. A stale one carries the lower floor and its own note. */
  extraOverrides?: readonly AppliedOverride[];
  /** Official sender with passing auth (or exact SMS sender) → score ≤ 19. */
  cap: boolean;
  /** False when nothing could be analysed → grey, never green. */
  analysed: boolean;
}

const blocklistFloor = SCORING.groupOverrides.find((item) => item.kind === "blocklist")?.floor ?? 80;
export const FLOOR_SCORE = blocklistFloor;
export const CAP_SCORE = 19;
export const MAX_REASONS = 8;

function matchesSignals(override: Extract<GroupOverride, { kind: "signals" }>, fired: ReadonlySet<string>): boolean {
  if (override.allOf.some((code) => !fired.has(code))) return false;
  return override.anyOf.every((group) => group.some((code) => fired.has(code)));
}

function matchingOverrides(fired: ReadonlySet<string>, blocklisted: boolean): AppliedOverride[] {
  const matched: AppliedOverride[] = [];
  for (const override of SCORING.groupOverrides) {
    switch (override.kind) {
      case "signals":
        if (matchesSignals(override, fired)) matched.push({ id: override.id, floor: override.floor, reason: override.reason });
        break;
      case "blocklist":
        if (blocklisted) matched.push({ id: override.id, floor: override.floor, reason: override.reason });
        break;
      default: {
        const unexpected: never = override;
        throw new Error(`Unexpected group override: ${String(unexpected)}`);
      }
    }
  }
  return matched.sort((a, b) => b.floor - a.floor);
}

/**
 * Combine reasons into the 0-100 score (SPEC 6.3). Each group is capped, then
 * the config floors raise the score. The highest matching floor wins.
 */
export function fuse(
  reasons: Reason[],
  opts: FusionOptions,
): Pick<AnalysisResult, "score" | "flag" | "groups" | "reasons" | "overridesApplied"> {
  const groups: Record<ReasonGroup, number> = { links: 0, content: 0, sender: 0, attachments: 0, reputation: 0 };
  for (const r of reasons) groups[r.group] += r.weight;
  for (const g of Object.keys(groups) as ReasonGroup[]) {
    groups[g] = Math.round(Math.min(GROUP_CAPS[g], Math.max(0, groups[g])) * 10) / 10;
  }

  const sorted = [...reasons].sort((a, b) => b.weight - a.weight).slice(0, MAX_REASONS);

  if (!opts.analysed) {
    return { score: 0, flag: "grey", groups, reasons: sorted, overridesApplied: [] };
  }

  let score = Math.round(Object.values(groups).reduce((a, b) => a + b, 0));
  if (opts.cap) score = Math.min(score, CAP_SCORE);
  const overridesApplied = [
    ...matchingOverrides(new Set(reasons.map((item) => item.code)), opts.floor),
    ...(opts.extraOverrides ?? []),
  ].sort((a, b) => b.floor - a.floor);
  for (const override of overridesApplied) score = Math.max(score, override.floor);
  score = Math.max(0, Math.min(100, score));

  return { score, flag: flagForScore(score, opts.thresholds), groups, reasons: sorted, overridesApplied };
}
