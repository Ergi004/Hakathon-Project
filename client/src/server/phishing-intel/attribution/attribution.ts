import "server-only";

import type { AdminClient } from "@/server/db";
import type { AnalysisResult } from "@/server/detection/types";
import type { AttributionResult, ExtractedIoc } from "../types";
import { attribute, type EvidenceRow } from "./confidence-engine";

const IOC_TYPE_MAP: Partial<Record<ExtractedIoc["type"], string>> = {
  url: "url",
  domain: "domain",
  ip: "ip",
  file_hash: "file_hash",
  email: "email",
  phone_number: "phone",
};

/**
 * Campaign correlation through the shared `iocs` table (the same records the SOC
 * curates), then actor evidence for that campaign or for the indicators themselves.
 */
export async function correlateAndAttribute(db: AdminClient, iocs: ExtractedIoc[], engine: AnalysisResult): Promise<AttributionResult> {
  const lookups = iocs.filter((i) => IOC_TYPE_MAP[i.type]).slice(0, 200);
  // The SOC may have stored indicators defanged (hxxp, [.]), so match both forms.
  const values = [...new Set(lookups.flatMap((i) => [i.normalized, i.display]))];

  let campaign: AttributionResult["campaign"] = null;
  if (values.length) {
    const { data } = await db
      .from("iocs")
      .select("type, value, campaigns!inner(id, code, status)")
      .in("value", values)
      .not("campaign_id", "is", null)
      .limit(200);
    const byCampaign = new Map<string, { id: string; code: string; status: string; matchedOn: string[] }>();
    for (const row of data ?? []) {
      const c = row.campaigns as unknown as { id: string; code: string; status: string };
      const entry = byCampaign.get(c.id) ?? { ...c, matchedOn: [] };
      entry.matchedOn.push(`${row.type}:${row.value}`);
      byCampaign.set(c.id, entry);
    }
    campaign = [...byCampaign.values()].sort((a, b) => b.matchedOn.length - a.matchedOn.length)[0] ?? null;
  }
  if (!campaign && engine.campaign?.id && engine.campaign.code) {
    campaign = { id: engine.campaign.id, code: engine.campaign.code, status: engine.campaign.matchType, matchedOn: ["engine campaign match"] };
  }

  const rows: EvidenceRow[] = [];
  const select = "actor_id, kind, source, source_url, verified, observed_at, ioc_type, ioc_value, campaign_id, threat_actors!inner(name)";
  if (campaign) {
    const { data } = await db.from("actor_evidence").select(select).eq("campaign_id", campaign.id).limit(100);
    for (const e of data ?? []) rows.push(toRow(e, "campaign", campaign.code));
  }
  if (values.length) {
    const { data } = await db.from("actor_evidence").select(select).in("ioc_value", values).limit(100);
    for (const e of data ?? []) rows.push(toRow(e, "indicator", `${e.ioc_type}:${e.ioc_value}`));
  }

  return attribute(campaign, rows);
}

function toRow(
  e: { actor_id: string; kind: string; source: string; source_url: string | null; verified: boolean; observed_at: string; threat_actors: unknown },
  via: EvidenceRow["via"],
  matched: string,
): EvidenceRow {
  return {
    actorId: e.actor_id,
    actorName: (e.threat_actors as { name: string }).name,
    kind: e.kind,
    source: e.source,
    sourceUrl: e.source_url,
    verified: e.verified,
    observedAt: e.observed_at,
    via,
    matched,
  };
}
