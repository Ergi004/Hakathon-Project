/**
 * SPEC 6.5: train TF-IDF + logistic regression on labels_mesazhet.csv + A_mesazhet.csv,
 * split 80/20 by campaign, write models/message-clf-v1.json and record metrics.
 * Run: npm run train
 */
import "./lib/env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { maskText } from "../src/server/detection/masks";
import { column, readCsv, requireDataset } from "./lib/csv";
import { scriptClient } from "./lib/supabase";
import { evaluate, splitByGroup, trainModel, type LabeledDoc } from "./lib/train";

export const MODEL_PATH = path.join(process.cwd(), "models", "message-clf-v1.json");

export function labelOf(value: string | undefined): 0 | 1 | null {
  const v = (value ?? "").trim().toLowerCase();
  if (/^(phishing|mashtrim|scam|spam|1|true|po)$/.test(v)) return 1;
  if (/^(legitimate|legjitim|ligjshem|ham|0|false|jo)$/.test(v)) return 0;
  return null;
}

export function loadLabeledDocs(): LabeledDoc[] {
  requireDataset(["A_mesazhet.csv", "labels_mesazhet.csv"]);
  const messages = readCsv("A_mesazhet.csv");
  const labels = readCsv("labels_mesazhet.csv");
  const mId = column(messages, "A_mesazhet.csv", ["mesazh_id", "id", "message_id"])!;
  const mText = column(messages, "A_mesazhet.csv", ["teksti_defanged", "teksti", "text"])!;
  const mCamp = column(messages, "A_mesazhet.csv", ["fushata_id", "campaign_id"], false);
  const lId = column(labels, "labels_mesazhet.csv", ["mesazh_id", "id", "message_id"])!;
  const lLabel = column(labels, "labels_mesazhet.csv", ["etiketa", "label"])!;

  const byId = new Map(labels.map((r) => [r[lId], labelOf(r[lLabel])]));
  const docs: LabeledDoc[] = [];
  for (const r of messages) {
    const label = byId.get(r[mId]);
    if (label === null || label === undefined) continue;
    docs.push({ id: r[mId], text: maskText(r[mText] ?? ""), label, group: (mCamp && r[mCamp]) || `single:${r[mId]}` });
  }
  return docs;
}

export async function runTraining({ record = true } = {}) {
  const docs = loadLabeledDocs();
  const { train, test } = splitByGroup(docs);
  console.log(`Training on ${train.length} messages, testing on ${test.length} (split by campaign)…`);
  const model = trainModel(train);
  const metrics = evaluate(model, test, train.length);
  model.metrics = { ...metrics };

  mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  writeFileSync(MODEL_PATH, JSON.stringify(model));
  console.table({ precision: metrics.precision, recall: metrics.recall, f1: metrics.f1, accuracy: metrics.accuracy, vocab: metrics.vocab_size });
  console.log(`Wrote ${path.relative(process.cwd(), MODEL_PATH)}`);

  if (record && process.env.SUPABASE_SECRET_KEY) {
    const db = scriptClient();
    await db.from("model_versions").update({ active: false }).eq("name", model.name);
    const { error } = await db
      .from("model_versions")
      .upsert(
        { name: model.name, version: model.version, metrics: { ...metrics }, artifact_path: "models/message-clf-v1.json", active: true },
        { onConflict: "name,version" },
      );
    if (error) throw new Error(`model_versions: ${error.message}`);
    console.log("Recorded active model_versions row.");
  }
  return metrics;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runTraining().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
