"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { refang } from "@/server/detection/normalize";
import { startDeepScanFor, startLiveScan } from "@/server/intel/orchestrator";

async function reportUrl(db: Parameters<Parameters<typeof staffAction>[3]>[1]["supabase"], reportId: string) {
  const r = check(await db.from("reports").select("messages(urls)").eq("id", reportId).single());
  const url = (r.messages as { urls: string[] } | null)?.urls?.[0];
  if (!url) throw new ActionError("invalid", "no_url");
  return refang(url);
}

/** Analyst: start a tier A scan for a report's first URL. */
export async function scanReportNow(input: unknown) {
  return staffAction("soc_analyst", z.object({ reportId: z.uuid() }), input, async ({ reportId }, ctx) => {
    const res = await startLiveScan({ url: await reportUrl(ctx.supabase, reportId), reportId, requestedBy: ctx.user.id });
    if (!res.ok) throw new ActionError("conflict", res.reason);
    await audit({ actorId: ctx.user.id, action: "intel.scan", entity: "report", entityId: reportId });
    revalidatePath("/[locale]/soc/inbox/[id]", "page");
    return { scanId: res.scanId };
  });
}

/** Analyst: "Run deep scan" (tier B: VirusTotal URL analysis + Hybrid Analysis). */
export async function runDeepScan(input: unknown) {
  return staffAction("soc_analyst", z.object({ reportId: z.uuid() }), input, async ({ reportId }, ctx) => {
    const { data: latest } = await ctx.supabase.from("scans").select("id").eq("report_id", reportId).eq("tier", "A").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (latest) {
      const r = await startDeepScanFor(latest.id);
      if (!r.ok) throw new ActionError("conflict", r.reason);
    } else {
      const res = await startLiveScan({ url: await reportUrl(ctx.supabase, reportId), reportId, deep: true, requestedBy: ctx.user.id });
      if (!res.ok) throw new ActionError("conflict", res.reason);
    }
    await audit({ actorId: ctx.user.id, action: "intel.deep_scan", entity: "report", entityId: reportId });
    revalidatePath("/[locale]/soc/inbox/[id]", "page");
    return null;
  });
}
