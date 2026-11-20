import "server-only";

import { isoDay, resolveWindow } from "@/lib/geo/filters";
import { NEIGHBORS, regionName } from "@/lib/geo/regions";
import { audit } from "@/server/audit";
import type { AdminClient } from "@/server/db";
import { mergeZones, ruleMatches, type AlertRule } from "./hotspots";
import { regionIdMaps } from "./regions";
import { aggregate, analyze, fetchStats, loadThresholds } from "./stats";

const DEDUP_HOURS = 6;
const KEEP_DAYS = 30;

/**
 * cron compute-geo-hotspots (every 10 minutes): writes one batch of geo_hotspots per mode and
 * notifies staff when a region first becomes elevated/critical (per active geo_alert_rules,
 * at most once per region and mode in 6 hours).
 */
export async function computeGeoHotspots(db: AdminClient) {
  const { idByCode, codeById } = await regionIdMaps(db);
  if (!idByCode.size) return { skipped: "regions not loaded (npm run seed:geo)" };
  const t = await loadThresholds(db);
  const computedAt = new Date().toISOString();
  const w = resolveWindow({ range: "custom", from: isoDay(new Date(Date.now() - (t.windowDays - 1) * 86_400_000)), to: isoDay(new Date()) }, undefined, t.baselineDays);

  const { data: rulesRaw } = await db.from("geo_alert_rules").select("min_reports, min_zscore, min_spike_ratio, institution_id, region_id").eq("active", true);
  const rules: AlertRule[] = (rulesRaw ?? []).map((r) => ({ minReports: r.min_reports, minZ: Number(r.min_zscore), minSpike: Number(r.min_spike_ratio), institutionId: r.institution_id, regionCode: r.region_id ? codeById.get(r.region_id) ?? null : null }));
  const { data: staff } = await db.from("profiles").select("id, locale").in("platform_role", ["soc_analyst", "soc_lead", "platform_admin"]);

  const summary: Record<string, { hot: number; alerts: number }> = {};
  for (const mode of ["victim", "imitated"] as const) {
    const filters = { mode, range: "7d", layers: [], metric: "count", view: "map", confirmed: false, compare: false } as unknown as Parameters<typeof fetchStats>[1];
    const rows = await fetchStats(db, filters, w.baselineFrom, w.to);
    const { per } = aggregate(rows, w, codeById);
    const results = analyze(per, t, w);
    const zones = mergeZones(results, NEIGHBORS);
    const zoneOf = new Map(zones.flatMap((z) => z.members.map((m) => [m, z.code] as const)));
    const hot = results.filter((r) => r.severity);
    const topOf = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    if (hot.length) {
      await db.from("geo_hotspots").insert(hot.map((r) => ({
        computed_at: computedAt, window_days: w.days.length, mode, region_id: idByCode.get(r.code)!,
        observed: r.observed, expected: +r.expected.toFixed(3), zscore: +r.z.toFixed(3), smoothed_rate: +r.smoothed.toFixed(3),
        spike_ratio: r.spike === null || r.spike === Infinity ? null : +r.spike.toFixed(3), severity: r.severity!,
        zone_code: zoneOf.get(r.code) ?? null, top_campaign_id: topOf(per.get(r.code)!.camp), top_institution_id: topOf(per.get(r.code)!.inst),
      })));
    }

    // Alerts: first time elevated/critical for this region+mode in the last 6 hours, matching a rule.
    let alerts = 0;
    const since = new Date(Date.now() - DEDUP_HOURS * 3_600_000).toISOString();
    for (const r of hot.filter((x) => x.severity === "elevated" || x.severity === "critical")) {
      const topInst = topOf(per.get(r.code)!.inst);
      if (!rules.some((rule) => ruleMatches(rule, r, topInst))) continue;
      const { count } = await db.from("geo_hotspots").select("id", { count: "exact", head: true })
        .eq("region_id", idByCode.get(r.code)!).eq("mode", mode).in("severity", ["elevated", "critical"]).gte("computed_at", since).lt("computed_at", computedAt);
      if (count) continue;
      const zone = zoneOf.get(r.code) ?? r.code;
      await db.from("notifications").insert((staff ?? []).map((s) => {
        const en = s.locale === "en";
        const sev = en ? r.severity : r.severity === "critical" ? "kritike" : "e ngritur";
        return {
          user_id: s.id,
          title: en ? `Hot zone ${sev}: ${regionName(zone, "en")} zone` : `Zonë e nxehtë ${sev}: zona ${regionName(zone, "sq")}`,
          body: en
            ? `${regionName(r.code, "en")}: ${r.observed} reports in ${w.days.length} days (expected ${r.expected.toFixed(1)}), ${mode === "victim" ? "reported from here" : "local authority imitated"}.`
            : `${regionName(r.code, "sq")}: ${r.observed} raportime në ${w.days.length} ditë (pritej ${r.expected.toFixed(1)}), ${mode === "victim" ? "raportuar nga kjo zonë" : "imitohet autoriteti vendor"}.`,
          href: `/soc/geo/${r.code}${mode === "imitated" ? "?mode=imitated" : ""}`,
        };
      }));
      alerts += 1;
    }
    summary[mode] = { hot: hot.length, alerts };
  }

  await db.from("geo_hotspots").delete().lt("computed_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  await audit({ actorId: null, action: "geo.hotspots.compute", entity: "system", data: summary });
  return summary;
}

/** Nightly full rebuild of region_daily_stats (safety net for the incremental trigger). */
export async function rebuildRegionStats(db: AdminClient) {
  const { data, error } = await db.rpc("rebuild_region_stats");
  if (error) throw new Error("rebuild_region_stats failed");
  return { reports: data };
}
