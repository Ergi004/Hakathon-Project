/**
 * Train message-clf on the public SMS, email, and URL datasets.
 * Raw rows stay outside the repo. The JSON artifact stores weights only.
 * Run from client/: npx tsx scripts/train-public.ts <jsonl>
 */
import "./lib/env";
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { maskText } from "../src/server/detection/masks";
import { channelToken } from "../src/server/detection/text-model";
import { scriptClient } from "./lib/supabase";
import { evaluate, splitByGroup, trainModel, type LabeledDoc } from "./lib/train";

const MODEL_PATH = path.join(process.cwd(), "models", "message-clf-v1.json");

interface Row {
  channel: "sms" | "email" | "url";
  label: 0 | 1;
  text: string;
  group: string;
}

async function loadRows(file: string): Promise<LabeledDoc[]> {
  const docs: LabeledDoc[] = [];
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let i = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as Row;
    const channel = row.channel === "url" ? "web" : row.channel;
    const text = `${channelToken(channel)}\n${maskText(row.text)}`.slice(0, 600);
    docs.push({ id: String(i), text, label: row.label, group: row.group || `single:${i}` });
    i += 1;
  }
  return docs;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Pass the JSONL of labeled rows.");
    process.exit(1);
  }
  const docs = await loadRows(file);
  const { train, test } = splitByGroup(docs);
  console.log(`Training on ${train.length} rows, testing on ${test.length}…`);
  const model = trainModel(train, { maxFeatures: 12000, epochs: 12, version: "v1" });
  const metrics = evaluate(model, test, train.length);
  model.metrics = { ...metrics, source: "public-sms-email-url" };
  mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  writeFileSync(MODEL_PATH, JSON.stringify(model));
  console.table({
    precision: metrics.precision,
    recall: metrics.recall,
    f1: metrics.f1,
    accuracy: metrics.accuracy,
    vocab: metrics.vocab_size,
  });
  console.log(`Wrote ${path.relative(process.cwd(), MODEL_PATH)}`);

  if (process.env.SUPABASE_SECRET_KEY) {
    const db = scriptClient();
    await db.from("model_versions").update({ active: false }).eq("name", model.name);
    const { error } = await db.from("model_versions").upsert(
      {
        name: model.name,
        version: model.version,
        metrics: { ...metrics, source: "public-sms-email-url" },
        artifact_path: "models/message-clf-v1.json",
        active: true,
      },
      { onConflict: "name,version" },
    );
    if (error) console.error(`model_versions: ${error.message}`);
    else console.log("Recorded active model_versions row.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
