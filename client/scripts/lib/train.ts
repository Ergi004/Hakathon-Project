import { features, predictWith, type TextModel } from "../../src/server/detection/text-model";
import { sha256 } from "../../src/server/hash";

export interface LabeledDoc {
  id: string;
  text: string;
  label: 0 | 1;
  /** Campaign code; documents of one campaign never span train and test (SPEC 6.5). */
  group: string;
}

export interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  train_size: number;
  test_size: number;
  vocab_size: number;
}

/** Deterministic 80/20 split by group (campaign), stratified by label. */
export function splitByGroup(docs: LabeledDoc[], testShare = 0.2): { train: LabeledDoc[]; test: LabeledDoc[] } {
  const train: LabeledDoc[] = [];
  const test: LabeledDoc[] = [];
  for (const label of [0, 1] as const) {
    const groups = new Map<string, LabeledDoc[]>();
    for (const d of docs.filter((x) => x.label === label)) {
      const g = groups.get(d.group) ?? [];
      g.push(d);
      groups.set(d.group, g);
    }
    const ordered = [...groups.entries()].sort((a, b) => sha256(a[0]).localeCompare(sha256(b[0])));
    const total = ordered.reduce((n, [, g]) => n + g.length, 0);
    let inTest = 0;
    for (const [, g] of ordered) {
      if (inTest < total * testShare) {
        test.push(...g);
        inTest += g.length;
      } else train.push(...g);
    }
  }
  return { train, test };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** TF-IDF + logistic regression (SGD with L2), exported as the TextModel JSON. */
export function trainModel(
  train: LabeledDoc[],
  opts: { minDf?: number; maxFeatures?: number; epochs?: number; lr?: number; l2?: number; version?: string } = {},
): TextModel {
  const { minDf = 2, maxFeatures = 20000, epochs = 25, lr = 0.5, l2 = 1e-5, version = "v1" } = opts;
  const df = new Map<string, number>();
  const featureCache = train.map((d) => features(d.text));
  for (const f of featureCache) for (const term of f.keys()) df.set(term, (df.get(term) ?? 0) + 1);

  const terms = [...df.entries()]
    .filter(([, n]) => n >= minDf)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxFeatures);
  const N = train.length;
  const vocab: TextModel["vocab"] = {};
  terms.forEach(([term, n], i) => {
    vocab[term] = [i, Math.round((Math.log((1 + N) / (1 + n)) + 1) * 1e4) / 1e4];
  });

  const vectors = featureCache.map((f) => {
    const v = new Map<number, number>();
    let norm = 0;
    for (const [term, count] of f) {
      const e = vocab[term];
      if (!e) continue;
      const x = (1 + Math.log(count)) * e[1];
      v.set(e[0], x);
      norm += x * x;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [k, x] of v) v.set(k, x / norm);
    return v;
  });

  const w = new Float64Array(terms.length);
  let b = 0;
  const rand = mulberry32(42);
  const order = train.map((_, i) => i);
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const rate = lr / (1 + epoch * 0.1);
    for (const idx of order) {
      const x = vectors[idx];
      let z = b;
      for (const [k, v] of x) z += w[k] * v;
      const p = 1 / (1 + Math.exp(-z));
      const g = p - train[idx].label;
      for (const [k, v] of x) w[k] -= rate * (g * v + l2 * w[k]);
      b -= rate * g;
    }
  }

  // Drop near-zero weights to keep the JSON small.
  const kept: TextModel["vocab"] = {};
  const weights: number[] = [];
  for (const [term, [i, idf]] of Object.entries(vocab)) {
    if (Math.abs(w[i]) < 1e-3) continue;
    kept[term] = [weights.length, idf];
    weights.push(Math.round(w[i] * 1e4) / 1e4);
  }
  return { name: "message-clf", version, kind: "tfidf-lr", vocab: kept, weights, bias: Math.round(b * 1e4) / 1e4 };
}

export function evaluate(model: TextModel, test: LabeledDoc[], trainSize: number, threshold = 0.5): Metrics {
  const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const d of test) {
    const pred = predictWith(model, d.text) >= threshold ? 1 : 0;
    if (pred === 1 && d.label === 1) c.tp++;
    else if (pred === 1) c.fp++;
    else if (d.label === 0) c.tn++;
    else c.fn++;
  }
  const precision = c.tp + c.fp ? c.tp / (c.tp + c.fp) : 0;
  const recall = c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return {
    precision: r(precision),
    recall: r(recall),
    f1: r(f1),
    accuracy: r(test.length ? (c.tp + c.tn) / test.length : 0),
    confusion: c,
    train_size: trainSize,
    test_size: test.length,
    vocab_size: model.weights.length,
  };
}
