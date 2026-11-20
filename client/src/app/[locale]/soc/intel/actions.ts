"use server";

import { after } from "next/server";
import { z } from "zod";
import { ActionError, staffAction } from "@/server/action";
import { tryAdmin } from "@/server/db";
import { runLandingPoll, startLanding } from "@/server/phishing-intel/sandbox/landing-service";

/**
 * "Analyse landing page" on /soc/intel/[id]: SOC analysts only. The URL must be
 * one of the scan's own indicators; it is sanitised and handed to urlscan.io.
 */
export async function analyzeLandingPage(input: unknown) {
  return staffAction("soc_analyst", z.object({ scanId: z.uuid(), url: z.url().max(2048) }), input, async (v, ctx) => {
    // RLS check with the analyst's own session before the secret-key client is used.
    const { data: scan } = await ctx.supabase.from("phishing_scans").select("id").eq("id", v.scanId).maybeSingle();
    if (!scan) throw new ActionError("notFound");
    const db = tryAdmin();
    if (!db) throw new ActionError("conflict", "unavailable");
    const r = await startLanding(db, { scanId: v.scanId, url: v.url, userId: ctx.user.id });
    if (!r.ok) throw new ActionError("invalid", r.error);
    if (r.pending) after(() => runLandingPoll(db, r.id));
    return { id: r.id, reused: r.reused };
  });
}
