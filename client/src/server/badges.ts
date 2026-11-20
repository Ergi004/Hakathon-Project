import "server-only";

import type { Enums } from "@/types/database";
import type { AdminClient } from "./db";

type Badge = "first_check" | "first_report" | "streak_7" | "quiz_master" | "extension_guard";

/** Award a badge (server only: badges are never self-awarded, RLS forbids it). */
export async function award(db: AdminClient, userId: string, badge: Badge) {
  await db.from("user_badges").upsert({ user_id: userId, badge }, { onConflict: "user_id,badge", ignoreDuplicates: true });
}

/**
 * SPEC 8 safety score: checks made (cap 20), reports filed (cap 30), quizzes
 * passed (cap 30), extension installed with consent (10), profile complete (10).
 * Recomputed on the server after each event, never trusted from the client.
 */
export async function recomputeSafetyScore(db: AdminClient, userId: string): Promise<number> {
  const [checks, reports, quizzes, ext, profile] = await Promise.all([
    db.from("user_check_links").select("check_id", { count: "exact", head: true }).eq("user_id", userId),
    db.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", userId),
    db.from("user_progress").select("guide_slug", { count: "exact", head: true }).eq("user_id", userId).gte("quiz_score", 67),
    db.from("extension_installs").select("id", { count: "exact", head: true }).eq("user_id", userId).not("consent_at", "is", null),
    db.from("profiles").select("full_name, locale").eq("id", userId).single(),
  ]);
  const score =
    Math.min(20, (checks.count ?? 0) * 2) +
    Math.min(30, (reports.count ?? 0) * 10) +
    Math.min(30, (quizzes.count ?? 0) * 5) +
    ((ext.count ?? 0) > 0 ? 10 : 0) +
    (profile.data?.full_name ? 10 : 0);
  await db.from("profiles").update({ safety_score: Math.min(100, score) }).eq("id", userId);
  if ((checks.count ?? 0) > 0) await award(db, userId, "first_check");
  if ((reports.count ?? 0) > 0) await award(db, userId, "first_report");
  if ((quizzes.count ?? 0) >= 6) await award(db, userId, "quiz_master");
  if ((ext.count ?? 0) > 0) await award(db, userId, "extension_guard");
  return score;
}

export type { Enums };
