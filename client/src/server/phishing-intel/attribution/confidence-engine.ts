import type { AttributionResult, AttributionStatus } from "../types";

/**
 * Evidence-based actor attribution (PDF §7.4). Pure.
 * - No explicit evidence row → unattributed (a campaign match alone names no actor).
 * - One kind of evidence or one source (e.g. a single shared IP) → at most "possible".
 * - ≥2 independent sources and ≥2 evidence kinds → "high_confidence".
 * - Same, plus at least one analyst-verified row → "confirmed".
 * - Two actors at the same level → downgraded to "possible" with the conflict noted.
 */

export interface EvidenceRow {
  actorId: string;
  actorName: string;
  kind: string;
  source: string;
  sourceUrl: string | null;
  verified: boolean;
  observedAt: string;
  via: "campaign" | "indicator";
  matched: string;
}

const RANK: Record<AttributionStatus, number> = { unattributed: 0, possible: 1, high_confidence: 2, confirmed: 3 };
const CONFIDENCE: Record<AttributionStatus, number> = { unattributed: 0, possible: 0.35, high_confidence: 0.7, confirmed: 0.9 };

function levelFor(rows: EvidenceRow[]): AttributionStatus {
  if (!rows.length) return "unattributed";
  const sources = new Set(rows.map((r) => r.source.trim().toLowerCase()));
  const kinds = new Set(rows.map((r) => r.kind));
  if (sources.size >= 2 && kinds.size >= 2) return rows.some((r) => r.verified) ? "confirmed" : "high_confidence";
  return "possible";
}

export function attribute(
  campaign: AttributionResult["campaign"],
  evidence: EvidenceRow[],
): AttributionResult {
  const facts: string[] = [];
  if (campaign) facts.push(`Indicators overlap with campaign ${campaign.code} (${campaign.status}) on: ${campaign.matchedOn.slice(0, 5).join(", ")}`);

  const byActor = new Map<string, EvidenceRow[]>();
  for (const e of evidence) byActor.set(e.actorId, [...(byActor.get(e.actorId) ?? []), e]);

  const ranked = [...byActor.entries()]
    .map(([id, rows]) => ({ id, name: rows[0].actorName, rows, level: levelFor(rows) }))
    .sort((a, b) => RANK[b.level] - RANK[a.level] || b.rows.length - a.rows.length);

  if (!ranked.length) {
    return {
      status: "unattributed",
      confidence: 0,
      campaign,
      actor: null,
      evidence: [],
      facts,
      assessment: "There is not enough reliable evidence to name a threat actor.",
      uncertainty: campaign
        ? "A campaign overlap groups related messages but does not identify who operates it."
        : "No overlap with known campaigns or actor-linked indicators was found.",
    };
  }

  const top = ranked[0];
  let status = top.level;
  let uncertainty = "Attribution relies on recorded evidence and may change as new intelligence arrives.";
  const rival = ranked[1];
  if (rival && RANK[rival.level] === RANK[top.level]) {
    status = "possible";
    uncertainty = `Evidence also points to ${rival.name}; the actors cannot be separated with current evidence.`;
  }
  for (const r of top.rows) facts.push(`${r.kind} evidence from ${r.source} via ${r.via} (${r.matched})`);

  return {
    status,
    confidence: CONFIDENCE[status],
    campaign,
    actor: { id: top.id, name: top.name },
    evidence: top.rows.map((r) => ({ kind: r.kind, source: r.source, sourceUrl: r.sourceUrl, verified: r.verified, observedAt: r.observedAt })),
    facts,
    assessment:
      status === "confirmed"
        ? `Attributed to ${top.name}: independent, analyst-verified evidence of more than one kind.`
        : status === "high_confidence"
          ? `Likely ${top.name}: multiple consistent indicators from independent sources.`
          : `Possibly ${top.name}: some overlap exists; further investigation is required.`,
    uncertainty,
  };
}
