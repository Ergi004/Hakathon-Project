"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/result";
import { trackSchema } from "@/lib/schemas/analysis";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";
import { getPublicTimeline, type PublicTimeline } from "@/server/tracking";

export async function trackReport(input: unknown): Promise<ActionResult<PublicTimeline, "invalid" | "notFound" | "rateLimited">> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await limit(`track:${ipHash(await headers())}`, 30, 600)).allowed) return { ok: false, error: "rateLimited" };
  const timeline = await getPublicTimeline(parsed.data.protocol, parsed.data.token);
  return timeline ? { ok: true, data: timeline } : { ok: false, error: "notFound" };
}
