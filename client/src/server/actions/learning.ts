"use server";

import { z } from "zod";
import { GUIDES } from "@/content/learn";
import type { ActionResult } from "@/lib/result";
import { getSessionUser } from "@/server/auth";
import { recomputeSafetyScore } from "@/server/badges";
import { tryAdmin } from "@/server/db";

const schema = z.object({ slug: z.enum(GUIDES.map((g) => g.slug) as [string, ...string[]]), score: z.number().int().min(0).max(100) });

/** Saves guide quiz progress for signed-in citizens (C6). Anonymous users: no-op. */
export async function recordGuideQuiz(input: unknown): Promise<ActionResult<{ saved: boolean }, "invalid">> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const session = await getSessionUser();
  if (!session) return { ok: true, data: { saved: false } };
  const { error } = await session.supabase.from("user_progress").upsert(
    { user_id: session.user.id, guide_slug: parsed.data.slug, quiz_score: parsed.data.score, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "user_id,guide_slug" },
  );
  const db = tryAdmin();
  if (!error && db) await recomputeSafetyScore(db, session.user.id);
  return { ok: true, data: { saved: !error } };
}
