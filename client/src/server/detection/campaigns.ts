import { sha256 } from "@/server/hash";
import { iocKey, type CampaignRef, type DetectionContext, type IocKind } from "./context";
import { foldText } from "./normalize";

export type CampaignMatch = {
  id?: string;
  code?: string;
  matchType: "known" | "similar" | "new_candidate";
  confidence: number;
};

const CONFIRMED: CampaignRef["status"][] = ["confirmed", "takedown_in_progress", "resolved"];

export function isConfirmed(c: CampaignRef): boolean {
  return CONFIRMED.includes(c.status);
}

/** SPEC 6.4 step 1: exact IoC match, confidence 1.0. Synchronous, used by analyze(). */
export function matchByIoc(
  iocs: { kind: IocKind; value: string }[],
  ctx: DetectionContext,
): (CampaignRef & { via: string }) | null {
  for (const i of iocs) {
    const hit = ctx.campaignIocs.get(iocKey(i.kind, i.value));
    if (hit) return { ...hit, via: i.value };
  }
  return null;
}

/** Template fingerprint of a masked body: digits, links and masks collapsed. */
export function templateFingerprint(maskedBody: string): string {
  const t = foldText(maskedBody)
    .replace(/\[[a-z]+\]/g, "<m>")
    .replace(/\b(?:https?|hxxps?):\/\/\S+|\S+\[\.\]\S+/g, "<url>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .slice(0, 200);
  return sha256(t).slice(0, 16);
}

export interface CampaignItem {
  iocs: { kind: IocKind; value: string }[];
  bodyHash?: string;
  maskedBody?: string;
  institutionId?: string;
  tactic?: string;
  registrar?: string | null;
  nameserver?: string | null;
  seenAt: Date;
}

/** Database access used by assignCampaign (implemented with Supabase in server code). */
export interface CampaignRepo {
  findByIoc(iocs: CampaignItem["iocs"]): Promise<CampaignRef | null>;
  findByBodyHash(bodyHash: string): Promise<CampaignRef | null>;
  /** pg_trgm similarity() against masked bodies of the last `days` days. */
  findSimilarBody(maskedBody: string, minSimilarity: number, days: number): Promise<(CampaignRef & { similarity: number }) | null>;
  findRelatedCampaign(q: {
    institutionId: string;
    tactic: string;
    since: Date;
    registrar?: string | null;
    nameserver?: string | null;
  }): Promise<CampaignRef | null>;
  countUnlinkedByFingerprint(fingerprint: string, hours: number): Promise<number>;
  createCandidate(fingerprint: string, item: CampaignItem): Promise<CampaignRef>;
}

/** SPEC 6.4: assign an item to a campaign or propose one. */
export async function assignCampaign(item: CampaignItem, repo: CampaignRepo): Promise<CampaignMatch | null> {
  // 1. Exact IoC
  const exact = await repo.findByIoc(item.iocs);
  if (exact) return { id: exact.id, code: exact.code, matchType: "known", confidence: 1 };

  // 2. Same body hash or trigram similarity ≥ 0.8 within 30 days
  if (item.bodyHash) {
    const same = await repo.findByBodyHash(item.bodyHash);
    if (same) return { id: same.id, code: same.code, matchType: "known", confidence: 1 };
  }
  if (item.maskedBody) {
    const similar = await repo.findSimilarBody(item.maskedBody, 0.8, 30);
    if (similar) {
      return { id: similar.id, code: similar.code, matchType: "known", confidence: Math.round(similar.similarity * 100) / 100 };
    }
  }

  // 3. Same institution + tactic within 7 days, shared registrar or nameserver → suggestion only
  if (item.institutionId && item.tactic && (item.registrar || item.nameserver)) {
    const since = new Date(item.seenAt.getTime() - 7 * 86_400_000);
    const related = await repo.findRelatedCampaign({
      institutionId: item.institutionId,
      tactic: item.tactic,
      since,
      registrar: item.registrar,
      nameserver: item.nameserver,
    });
    if (related) return { id: related.id, code: related.code, matchType: "similar", confidence: 0.6 };
  }

  // 4. ≥ 3 unlinked items share a template fingerprint within 48 h → new candidate
  if (item.maskedBody) {
    const fp = templateFingerprint(item.maskedBody);
    const count = await repo.countUnlinkedByFingerprint(fp, 48);
    if (count + 1 >= 3) {
      const created = await repo.createCandidate(fp, item);
      return { id: created.id, code: created.code, matchType: "new_candidate", confidence: 0.5 };
    }
  }
  return null;
}

/** C-2026-0001 style code for detected campaigns. */
export function candidateCode(year: number, seq: number): string {
  return `C-${year}-${String(seq).padStart(4, "0")}`;
}
