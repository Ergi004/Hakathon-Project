"use server";

import { z } from "zod";
import { parseGeoFilters } from "@/lib/geo/filters";
import { isMunicipalityCode } from "@/lib/geo/regions";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { getRegionDetail } from "@/server/geo/stats";

const code = z.string().refine(isMunicipalityCode, "unknown region");

/** Drawer data: aggregates and masked rows only. */
export async function loadRegionDetail(input: unknown) {
  return staffAction("soc_analyst", z.object({ code, query: z.string().max(2000), locale: z.enum(["sq", "en"]) }), input, async ({ code, query, locale }, ctx) => {
    const detail = await getRegionDetail(ctx.supabase, code, parseGeoFilters(Object.fromEntries(new URLSearchParams(query))), locale);
    if (!detail) throw new ActionError("notFound");
    return detail;
  });
}

/** Analyst note on a region (report_events-style, audited). */
export async function addRegionNote(input: unknown) {
  return staffAction("soc_analyst", z.object({ code, body: z.string().trim().min(1).max(2000) }), input, async ({ code, body }, ctx) => {
    const region = check(await ctx.supabase.from("regions").select("id").eq("code", code).single());
    const note = check(await ctx.supabase.from("region_notes").insert({ region_id: region.id, author_id: ctx.user.id, body }).select("id").single());
    await audit({ actorId: ctx.user.id, action: "geo.note", entity: "region", entityId: region.id, data: { code } });
    return { id: note.id };
  });
}

/** Client-side exports (PNG) are audited here; CSV/GeoJSON are audited by their route. */
export async function logGeoExport(input: unknown) {
  return staffAction("soc_analyst", z.object({ kind: z.enum(["png", "print"]), query: z.string().max(2000) }), input, async ({ kind, query }, ctx) => {
    await audit({ actorId: ctx.user.id, action: `geo.export.${kind}`, entity: "geo", data: { filters: query } });
    return null;
  });
}
