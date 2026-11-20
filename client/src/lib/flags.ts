import type { Enums } from "@/types/database";

export type FlagLevel = Enums<"flag_level">;

export const FLAG_LEVELS: readonly FlagLevel[] = ["green", "yellow", "orange", "red", "darkred", "grey"];

export interface Thresholds {
  yellow: number;
  orange: number;
  red: number;
  darkred: number;
}

/** SPEC 6.3 defaults; the live values come from settings.thresholds. */
export const DEFAULT_THRESHOLDS: Thresholds = { yellow: 20, orange: 40, red: 60, darkred: 80 };

export function flagForScore(score: number, t: Thresholds = DEFAULT_THRESHOLDS): Exclude<FlagLevel, "grey"> {
  if (score >= t.darkred) return "darkred";
  if (score >= t.red) return "red";
  if (score >= t.orange) return "orange";
  if (score >= t.yellow) return "yellow";
  return "green";
}

/** Tailwind classes per flag. Always paired with an icon and a word in the UI. */
export const FLAG_STYLES: Record<FlagLevel, { text: string; bg: string; border: string; stroke: string }> = {
  green: { text: "text-flag-green", bg: "bg-flag-green/12", border: "border-flag-green/40", stroke: "stroke-flag-green" },
  yellow: { text: "text-flag-yellow", bg: "bg-flag-yellow/14", border: "border-flag-yellow/45", stroke: "stroke-flag-yellow" },
  orange: { text: "text-flag-orange", bg: "bg-flag-orange/14", border: "border-flag-orange/45", stroke: "stroke-flag-orange" },
  red: { text: "text-flag-red", bg: "bg-flag-red/12", border: "border-flag-red/45", stroke: "stroke-flag-red" },
  darkred: { text: "text-flag-darkred", bg: "bg-flag-darkred/14", border: "border-flag-darkred/50", stroke: "stroke-flag-darkred" },
  grey: { text: "text-flag-grey", bg: "bg-flag-grey/12", border: "border-flag-grey/40", stroke: "stroke-flag-grey" },
};
