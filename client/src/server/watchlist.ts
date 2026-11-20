import "server-only";

import type { AdminClient } from "./db";
import { extractEmails, extractPhones, foldText } from "./detection/normalize";
import { sha256 } from "./hash";

/** Canonical hash of a watch item (SPEC 8 C5: stored hashed; match on hash only). */
export function watchHash(kind: "phone" | "email" | "name", value: string): string {
  const v = kind === "phone" ? value.replace(/[^\d+]/g, "").replace(/^00/, "+").replace(/^0/, "+355") : kind === "email" ? value.trim().toLowerCase() : foldText(value).replace(/\s+/g, " ");
  return sha256(`watch:${kind}:${v}`);
}

/** Masked hint shown to the owner, e.g. +355 69 *** **67. */
export function watchLabel(kind: "phone" | "email" | "name", value: string): string {
  const v = value.trim();
  if (kind === "phone") return v.replace(/\d(?=[\d\s]{2})/g, (d, i) => (i < 6 ? d : "*"));
  if (kind === "email") return v.replace(/^(.).*(@.*)$/, "$1***$2");
  return v.split(/\s+/).map((w) => `${w[0]}${"*".repeat(Math.max(1, w.length - 1))}`).join(" ");
}

/**
 * Before masking a new report, hash its phones and emails and notify citizens
 * whose watch items match. The raw values never leave this function.
 */
export async function notifyWatchMatches(db: AdminClient, rawText: string, sender: string | undefined, protocol: string) {
  const all = `${rawText}\n${sender ?? ""}`;
  const hashes = [...extractPhones(all).map((p) => watchHash("phone", p)), ...extractEmails(all).map((e) => watchHash("email", e))];
  if (!hashes.length) return;
  const { data } = await db.from("user_watch_items").select("id, user_id, label").in("value_hash", hashes);
  for (const w of data ?? []) {
    await db.from("user_watch_items").update({ last_match_at: new Date().toISOString() }).eq("id", w.id);
    await db.from("notifications").insert({ user_id: w.user_id, title: `${w.label} — ${protocol}`, body: "watch_match", href: "/citizen/watchlist" });
  }
}
