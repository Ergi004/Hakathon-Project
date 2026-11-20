/**
 * Score public URL and SMS datasets with the current check engine.
 * Reads local files only. Does not write to Supabase and does not keep message text.
 *
 * Run from client/: npx tsx scripts/eval-public-datasets.ts
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import Papa from "papaparse";
import { analyze, type AnalyzeOptions } from "../src/server/detection/index";
import { ctx } from "../src/server/detection/__tests__/fixtures";
import type { AnalysisInput } from "../src/server/detection/types";

const YELLOW = 20;
const context = ctx();
const opts: AnalyzeOptions = { model: null };

interface Tally {
  name: string;
  rows: number;
  skipped: number;
  positive: number;
  negative: number;
  flaggedPositive: number;
  flaggedNegative: number;
  anyPositive: number;
  anyNegative: number;
  patternPositive: number;
  patternNegative: number;
  reasons: Map<string, number>;
}

function empty(name: string): Tally {
  return {
    name,
    rows: 0,
    skipped: 0,
    positive: 0,
    negative: 0,
    flaggedPositive: 0,
    flaggedNegative: 0,
    anyPositive: 0,
    anyNegative: 0,
    patternPositive: 0,
    patternNegative: 0,
    reasons: new Map(),
  };
}

async function score(input: AnalysisInput, positive: boolean, tally: Tally) {
  const result = await analyze(input, context, opts);
  tally.rows += 1;
  const flagged = result.score >= YELLOW;
  const any = result.score > 0;
  const patterned = result.classification.scamType !== "other";
  if (positive) {
    tally.positive += 1;
    if (flagged) tally.flaggedPositive += 1;
    if (any) tally.anyPositive += 1;
    if (patterned) tally.patternPositive += 1;
    for (const reason of result.reasons) {
      if (reason.weight <= 0) continue;
      tally.reasons.set(reason.code, (tally.reasons.get(reason.code) ?? 0) + 1);
    }
  } else {
    tally.negative += 1;
    if (flagged) tally.flaggedNegative += 1;
    if (any) tally.anyNegative += 1;
    if (patterned) tally.patternNegative += 1;
  }
}

function pct(part: number, whole: number): string {
  if (!whole) return "n/a";
  return `${((100 * part) / whole).toFixed(1)}%`;
}

function report(tally: Tally) {
  console.log(`\n${tally.name}`);
  console.log(
    `  rows ${tally.rows}  skipped ${tally.skipped}  positive ${tally.positive}  negative ${tally.negative}`,
  );
  console.log(
    `  score>=20  catch ${pct(tally.flaggedPositive, tally.positive)}  false alarms ${pct(tally.flaggedNegative, tally.negative)}`,
  );
  console.log(
    `  score>0    catch ${pct(tally.anyPositive, tally.positive)}  false alarms ${pct(tally.anyNegative, tally.negative)}`,
  );
  console.log(
    `  pattern type  catch ${pct(tally.patternPositive, tally.positive)}  false alarms ${pct(tally.patternNegative, tally.negative)}`,
  );
  const top = [...tally.reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) console.log(`  top signals on threats  ${top.map(([code, n]) => `${code} ${pct(n, tally.positive)}`).join(", ")}`);
}

async function eachCsv(file: string, onRow: (row: Record<string, string>) => Promise<void>) {
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    Papa.parse<Record<string, string>>(stream, {
      header: true,
      skipEmptyLines: true,
      step: (row, parser) => {
        parser.pause();
        onRow(row.data)
          .then(() => parser.resume())
          .catch(reject);
      },
      complete: () => resolve(),
      error: reject,
    });
  });
}

async function scoreSms(file: string) {
  const tally = empty("SMS smish collection");
  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of lines) {
    const tab = line.indexOf("\t");
    if (tab < 0) {
      tally.skipped += 1;
      continue;
    }
    const label = line.slice(0, tab).trim().toLowerCase();
    const text = line.slice(tab + 1).trim();
    if (!text) {
      tally.skipped += 1;
      continue;
    }
    const positive = label === "smish" || label === "spam";
    const negative = label === "ham";
    if (!positive && !negative) {
      tally.skipped += 1;
      continue;
    }
    await score({ kind: "text", channel: "sms", locale: "en", text }, positive, tally);
  }
  report(tally);
}

async function scoreUrlFile(name: string, file: string, labelOf: (row: Record<string, string>) => boolean | null, urlOf: (row: Record<string, string>) => string) {
  const tally = empty(name);
  let seen = 0;
  await eachCsv(file, async (row) => {
    const label = labelOf(row);
    const url = urlOf(row).trim();
    if (label === null || !url) {
      tally.skipped += 1;
      return;
    }
    await score({ kind: "url", channel: "web", locale: "en", urls: [url] }, label, tally);
    seen += 1;
    if (seen % 50000 === 0) console.log(`  …${name} ${seen}`);
  });
  report(tally);
}

async function main() {
  const root = process.argv[2] ?? "";
  if (!root) {
    console.error("Pass the extracted dataset directory.");
    process.exit(1);
  }

  const known = await analyze(
    {
      kind: "text",
      channel: "sms",
      locale: "sq",
      text: "Bashkia Lezhë: Keni një gjobë parkimi të papaguar. Paguani sot brenda 24 orëve në 1ezhe-gov[.]al[.]example për të shmangur dyfishimin.",
    },
    context,
    opts,
  );
  console.log(`sanity fine SMS score=${known.score} type=${known.classification.scamType}`);

  await scoreSms(`${root}/SMSSmishCollection.txt`);
  await scoreUrlFile(
    "malicious_phish (phishing vs benign)",
    `${root}/malicious_phish.csv`,
    (row) => {
      const type = (row.type ?? "").toLowerCase();
      if (type === "phishing") return true;
      if (type === "benign") return false;
      return null;
    },
    (row) => row.url ?? "",
  );
  for (const type of ["defacement", "malware"] as const) {
    await scoreUrlFile(
      `malicious_phish (${type} only)`,
      `${root}/malicious_phish.csv`,
      (row) => ((row.type ?? "").toLowerCase() === type ? true : null),
      (row) => row.url ?? "",
    );
  }
  await scoreUrlFile(
    "PhishTank 2026 (all labeled phishing)",
    `${root}/PhishTank_2026.csv`,
    (row) => ((row.Label ?? row.label) === "1" ? true : null),
    (row) => row.URL ?? row.url ?? "",
  );
  for (const split of ["train", "val", "test"] as const) {
    await scoreUrlFile(
      `homograph ${split}`,
      `${root}/homograph_phishing_${split}.csv`,
      (row) => {
        if (row.label === "1") return true;
        if (row.label === "0") return false;
        return null;
      },
      (row) => row.url ?? "",
    );
  }
  console.log("\nDONE");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
