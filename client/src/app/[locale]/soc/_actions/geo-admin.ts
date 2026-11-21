"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isMunicipalityCode } from "@/lib/geo/regions";
import { ActionError, check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { tryAdmin } from "@/server/db";
import type { Json } from "@/types/database";

const level = (extra: z.ZodRawShape = {}) => z.object({ minObserved: z.number().int().min(3).max(1000), minZ: z.number().min(0).max(20), ...extra });
const thresholdsSchema = z.object({
  watch: level(),
  elevated: level(),
  critical: level({ minSpike: z.number().min(1).max(100) }),
  windowDays: z.number().int().min(1).max(30),
  baselineDays: z.number().int().min(7).max(120),
}).refine((t) => t.watch.minObserved <= t.elevated.minObserved && t.elevated.minObserved <= t.critical.minObserved, { message: "order" });

/** Lead: severity thresholds for hot-zone detection (settings.geo_thresholds), audited. */
export async function saveGeoThresholds(input: unknown) {
  return staffAction("soc_lead", thresholdsSchema, input, async (value, ctx) => {
    const db = tryAdmin();
    if (!db) throw new ActionError("conflict", "unavailable");
    check(await db.from("settings").upsert({ key: "geo_thresholds", value: value as unknown as Json, updated_by: ctx.user.id, updated_at: new Date().toISOString() }).select("key").single());
    await audit({ actorId: ctx.user.id, action: "geo.thresholds.update", entity: "settings", data: value as unknown as Record<string, Json> });
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

const ruleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  minReports: z.number().int().min(3).max(1000),
  minZ: z.number().min(0).max(20),
  minSpike: z.number().min(0).max(100),
  institutionId: z.uuid().nullable(),
  regionCode: z.string().refine(isMunicipalityCode).nullable(),
});

/** Lead: create a geo alert rule (RLS: leads only), audited. */
export async function createGeoAlertRule(input: unknown) {
  return staffAction("soc_lead", ruleSchema, input, async (r, ctx) => {
    const regionId = r.regionCode ? check(await ctx.supabase.from("regions").select("id").eq("code", r.regionCode).single()).id : null;
    const row = check(await ctx.supabase.from("geo_alert_rules").insert({ name: r.name, min_reports: r.minReports, min_zscore: r.minZ, min_spike_ratio: r.minSpike, institution_id: r.institutionId, region_id: regionId, created_by: ctx.user.id }).select("id").single());
    await audit({ actorId: ctx.user.id, action: "geo.rule.create", entity: "geo_alert_rule", entityId: row.id, data: r });
    revalidatePath("/[locale]/soc/admin", "page");
    return { id: row.id };
  });
}

export async function setGeoAlertRuleActive(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid(), active: z.boolean() }), input, async ({ id, active }, ctx) => {
    check(await ctx.supabase.from("geo_alert_rules").update({ active }).eq("id", id).select("id").single());
    await audit({ actorId: ctx.user.id, action: active ? "geo.rule.enable" : "geo.rule.disable", entity: "geo_alert_rule", entityId: id });
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}

export async function deleteGeoAlertRule(input: unknown) {
  return staffAction("soc_lead", z.object({ id: z.uuid() }), input, async ({ id }, ctx) => {
    check(await ctx.supabase.from("geo_alert_rules").delete().eq("id", id).select("id").single());
    await audit({ actorId: ctx.user.id, action: "geo.rule.delete", entity: "geo_alert_rule", entityId: id });
    revalidatePath("/[locale]/soc/admin", "page");
    return null;
  });
}
