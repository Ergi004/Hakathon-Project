/**
 * Fill connection, nameserver, and lure-place on synthetic check features.
 * Only hosts ending in .example or .test are touched. Message text is not written.
 * Run from client/: npx tsx scripts/fill-pattern-features.ts
 */
import "./lib/env";
import type { Json } from "../src/types/database";
import { must, scriptClient } from "./lib/supabase";

const NAMESERVERS: Record<string, string> = {
  "QuickNames Shembull LLC": "ns1.shembull.test",
  "Regjistri Lindor (fiktiv)": "ns1.lindor.test",
  "Domeni Ekspres (fiktiv)": "ns1.ekspres.test",
};

const PLACES: Record<string, string> = {
  tirana: "Tiranë",
  tlrana: "Tiranë",
  shkoder: "Shkodër",
  shkodra: "Shkodër",
  pogradec: "Pogradec",
  pogradeec: "Pogradec",
  durres: "Durrës",
  kukes: "Kukës",
  vlore: "Vlorë",
  vlora: "Vlorë",
  elbasan: "Elbasan",
  fier: "Fier",
  lezhe: "Lezhë",
  lezha: "Lezhë",
};

const EXFIL_HOSTS = new Set(["e-albania-perditesim.example", "e-aibania.example"]);
const EXFIL = [{ kind: "telegram", url: "https://t.me/shembull-njoftime", endpoint: "t.me/shembull-njoftime" }];

function placeFromHost(host: string): string | null {
  const tokens = host.toLowerCase().split(/[^a-z0-9]+/);
  for (const token of tokens) {
    const place = PLACES[token];
    if (place) return place;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function main() {
const db = scriptClient();
const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
const rows = must(
  await db.from("checks").select("id, features").gte("created_at", since).not("features", "is", null).limit(5000),
  "load checks",
);

let updated = 0;
for (const row of rows) {
  if (!isRecord(row.features)) continue;
  const domain = isRecord(row.features.domain) ? row.features.domain : null;
  const host = typeof domain?.host === "string" ? domain.host : "";
  if (!host.endsWith(".example") && !host.endsWith(".test")) continue;
  const infrastructure = isRecord(row.features.infrastructure) ? { ...row.features.infrastructure } : {};
  const registrar = typeof infrastructure.registrar === "string" ? infrastructure.registrar : "";
  const nameserver = typeof infrastructure.nameserver === "string" && infrastructure.nameserver.trim() ? infrastructure.nameserver : NAMESERVERS[registrar] ?? null;
  if (nameserver) infrastructure.nameserver = nameserver;
  const claimed = typeof row.features.claimedPlace === "string" && row.features.claimedPlace.trim() ? row.features.claimedPlace : placeFromHost(host);
  const exfilHost = EXFIL_HOSTS.has(host);
  const featureOverlap = exfilHost
    ? { reason: "shared_exfil", evidence: "t.me/shembull-njoftime" }
    : isRecord(row.features.featureOverlap) && typeof row.features.featureOverlap.reason === "string"
      ? row.features.featureOverlap
      : { reason: "shared_domain", evidence: host };
  const next = {
    ...row.features,
    infrastructure,
    claimedPlace: claimed,
    exfil: exfilHost ? EXFIL : row.features.exfil,
    featureOverlap,
  };
  if (JSON.stringify(next) === JSON.stringify(row.features)) continue;
  must(await db.from("checks").update({ features: next as Json }).eq("id", row.id), "update check");
  updated += 1;
}

console.log(`updated ${updated} synthetic check feature rows`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "fill failed");
  process.exit(1);
});
