import { readFileSync } from "node:fs";
import path from "node:path";
import { foldText } from "./normalize";

/**
 * TF-IDF + logistic regression exported to JSON by scripts/train-classifier.ts
 * (SPEC 6.1 / 6.5). Inference is a sparse dot product. When no trained model is
 * present, a small hand-weighted lexicon model keeps scores sensible: the
 * classifier is one input, never the only one.
 */
export interface TextModel {
  name: string;
  version: string;
  kind: "tfidf-lr";
  /** term → [column index, idf] */
  vocab: Record<string, [number, number]>;
  weights: number[];
  bias: number;
  metrics?: Record<string, unknown>;
}

const URL_TOKEN = "__url__";

/** Word unigrams, word bigrams and character 3-5 grams over folded text. */
export function features(text: string): Map<string, number> {
  const folded = foldText(text).replace(/\b(?:https?|hxxps?):\/\/\S+|\S+\[\.\]\S+/g, ` ${URL_TOKEN} `);
  const words = folded.split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 1 || w === URL_TOKEN);
  const counts = new Map<string, number>();
  const add = (t: string) => counts.set(t, (counts.get(t) ?? 0) + 1);
  for (let i = 0; i < words.length; i++) {
    add(`w:${words[i]}`);
    if (i + 1 < words.length) add(`b:${words[i]} ${words[i + 1]}`);
  }
  for (const w of words) {
    if (w === URL_TOKEN) continue;
    const padded = ` ${w} `;
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i + n <= padded.length; i++) add(`c:${padded.slice(i, i + n)}`);
    }
  }
  return counts;
}

/** Sparse TF-IDF vector (sublinear tf, L2-normalised) restricted to the model vocabulary. */
export function vectorize(text: string, vocab: TextModel["vocab"]): Map<number, number> {
  const vec = new Map<number, number>();
  let norm = 0;
  for (const [term, count] of features(text)) {
    const entry = vocab[term];
    if (!entry) continue;
    const v = (1 + Math.log(count)) * entry[1];
    vec.set(entry[0], v);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of vec) vec.set(k, v / norm);
  return vec;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predictWith(model: TextModel, text: string): number {
  let z = model.bias;
  for (const [i, v] of vectorize(text, model.vocab)) z += (model.weights[i] ?? 0) * v;
  return sigmoid(z);
}

/** Fallback lexicon model ("lexicon-v0"): each matched cue adds its weight once. */
const LEXICON: [RegExp, number][] = [
  [/\b(?:kliko|klikoni|click|tap)\b/, 1.0],
  [/\b(?:verifiko|verifikoni|verify|konfirmo|konfirmoni|confirm)\b/, 0.9],
  [/\b(?:gjob\w*|fine[sd]?|penalt\w*)\b/, 0.9],
  [/\b(?:pagu\w*|pay(?:ment)?|pages\w*)\b/, 0.9],
  [/\b(?:urgjent\w*|urgent\w*|menjehere|immediately)\b/, 0.8],
  [/\b(?:bllok\w*|pezull\w*|blocked|suspend\w*)\b/, 0.9],
  [/\b(?:rimburs\w*|refund\w*|kthim)\b/, 0.9],
  [/\b(?:fitu\w*|prize|won|shperblim\w*)\b/, 1.0],
  [/\b(?:dergese|dergesa|pako|parcel|package|delivery)\b/, 0.7],
  [/\b(?:kart\w*|card|cvv|otp|pin|kod\w*|code)\b/, 0.7],
  [/\b(?:llogari\w*|account)\b/, 0.5],
  [/\b(?:sot|today|brenda|within|afat\w*)\b/, 0.4],
  [/\b(?:perditeso\w*|update)\b/, 0.5],
  [/__url__/, 0.8],
];

export function predictLexicon(text: string): number {
  const folded = foldText(text).replace(/\b(?:https?|hxxps?):\/\/\S+|\S+\[\.\]\S+/g, " __url__ ");
  let z = -2.2;
  for (const [re, w] of LEXICON) if (re.test(folded)) z += w;
  return sigmoid(z);
}

let cached: TextModel | null | undefined;

/** Loads models/message-clf-v1.json once; null when not trained yet. */
export function loadModel(): TextModel | null {
  if (cached !== undefined) return cached;
  try {
    const file = path.join(process.cwd(), "models", "message-clf-v1.json");
    cached = JSON.parse(readFileSync(file, "utf8")) as TextModel;
  } catch {
    cached = null;
  }
  return cached;
}

export function classify(text: string, model: TextModel | null = loadModel()): { probability: number; version: string } {
  if (!text.trim()) return { probability: 0, version: model ? `${model.name}@${model.version}` : "lexicon-v0" };
  if (model) return { probability: predictWith(model, text), version: `${model.name}@${model.version}` };
  return { probability: predictLexicon(text), version: "lexicon-v0" };
}
