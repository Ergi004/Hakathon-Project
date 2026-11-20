import "server-only";

import { tryAdmin } from "./db";
import { limit } from "./rate-limit";

/** Counts each (simulation, recipient token) event once; no recipient identity is stored. */
export async function recordSimEvent(simId: string, token: string, kind: "opened" | "clicked" | "reported") {
  if (!/^[0-9a-f]{24}$/.test(token)) return;
  const once = await limit(`sim:${kind}:${simId}:${token}`, 1, 60 * 60 * 24 * 60);
  if (!once.allowed) return;
  const db = tryAdmin();
  if (!db) return;
  const { data } = await db.from("simulations").select(kind).eq("id", simId).eq("status", "running").maybeSingle();
  if (!data) return;
  const next = ((data as Record<string, number>)[kind] ?? 0) + 1;
  const patch = kind === "opened" ? { opened: next } : kind === "clicked" ? { clicked: next } : { reported: next };
  await db.from("simulations").update(patch).eq("id", simId);
}
