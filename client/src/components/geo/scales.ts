import { scaleThreshold } from "d3-scale";
import { quantile } from "simple-statistics";

export type Metric = "count" | "rate" | "change" | "z";

export const SEQ = ["var(--geo-1)", "var(--geo-2)", "var(--geo-3)", "var(--geo-4)", "var(--geo-5)", "var(--geo-6)"];
export const DIV = ["var(--geo-neg-2)", "var(--geo-neg-1)", "var(--geo-mid)", "var(--geo-pos-1)", "var(--geo-pos-2)"];

export interface ColorScale {
  kind: "sequential" | "diverging";
  breaks: number[];
  colors: string[];
  color: (v: number) => string;
  format: (v: number) => string;
}

const fmtNum = (v: number) => (Math.abs(v) >= 10 ? Math.round(v).toString() : (+v.toFixed(1)).toString());
const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** Quantile class breaks (simple-statistics) over the non-zero values; unique and ascending. */
export function quantileBreaks(values: number[], classes = SEQ.length): number[] {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return [1];
  const qs = Array.from({ length: classes - 1 }, (_, i) => quantile(v, (i + 1) / classes));
  return [...new Set(qs.map((q) => +q.toFixed(2)))].filter((q) => q > 0);
}

export function makeScale(metric: Metric, values: number[]): ColorScale {
  if (metric === "change") {
    const breaks = [-0.5, -0.1, 0.1, 0.5];
    const s = scaleThreshold<number, string>().domain(breaks).range(DIV);
    return { kind: "diverging", breaks, colors: DIV, color: (x) => s(x), format: fmtPct };
  }
  if (metric === "z") {
    const breaks = [0, 1, 1.5, 2, 3];
    const s = scaleThreshold<number, string>().domain(breaks).range(SEQ);
    return { kind: "sequential", breaks, colors: SEQ, color: (x) => s(x), format: (x) => x.toFixed(1) };
  }
  const breaks = quantileBreaks(values);
  const colors = SEQ.slice(SEQ.length - (breaks.length + 1));
  const s = scaleThreshold<number, string>().domain(breaks).range(colors);
  return { kind: "sequential", breaks, colors, color: (x) => s(x), format: fmtNum };
}

/** Diverging scale for difference maps (this period − previous), symmetric around zero. */
export function differenceScale(values: number[]): ColorScale {
  const m = Math.max(2, ...values.map((v) => Math.abs(v)));
  const breaks = [-m / 2, -0.5, 0.5, m / 2].map((b) => +b.toFixed(1));
  const s = scaleThreshold<number, string>().domain(breaks).range(DIV);
  return { kind: "diverging", breaks, colors: DIV, color: (x) => s(x), format: (x) => `${x > 0 ? "+" : ""}${fmtNum(x)}` };
}
