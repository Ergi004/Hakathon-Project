import "server-only";

import type { Ctx } from "@/server/auth";
import { tryAdmin } from "@/server/db";
import { award } from "@/server/badges";

/** Consecutive days (ending today or yesterday) with a check, report or lesson. Awards streak_7. */
export async function getStreak(ctx: Ctx): Promise<number> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [c, r, p] = await Promise.all([
    ctx.supabase.from("user_check_links").select("created_at").eq("user_id", ctx.user.id).gte("created_at", since),
    ctx.supabase.from("reports").select("created_at").eq("reporter_id", ctx.user.id).gte("created_at", since),
    ctx.supabase.from("user_progress").select("updated_at").eq("user_id", ctx.user.id).gte("updated_at", since),
  ]);
  const days = new Set([...(c.data ?? []).map((x) => x.created_at), ...(r.data ?? []).map((x) => x.created_at), ...(p.data ?? []).map((x) => x.updated_at)].map((d) => d.slice(0, 10)));
  let streak = 0;
  const day = new Date();
  if (!days.has(day.toISOString().slice(0, 10))) day.setUTCDate(day.getUTCDate() - 1);
  while (days.has(day.toISOString().slice(0, 10))) {
    streak += 1;
    day.setUTCDate(day.getUTCDate() - 1);
  }
  if (streak >= 7) {
    const db = tryAdmin();
    if (db) await award(db, ctx.user.id, "streak_7");
  }
  return streak;
}
