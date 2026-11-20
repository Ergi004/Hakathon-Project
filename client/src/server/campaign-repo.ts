import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { candidateCode, templateFingerprint, type CampaignRepo } from "./detection/campaigns";
import { defang } from "./detection/normalize";

/**
 * Supabase implementation of the SPEC 6.4 repository. With dryRun, step 4
 * reports a "new_candidate" without creating anything (used on page views).
 */
export function supabaseCampaignRepo(db: SupabaseClient<Database>, opts: { dryRun?: boolean } = {}): CampaignRepo {
  return {
    async findByIoc(iocs) {
      const values = iocs.flatMap((i) => [i.value, defang(i.value)]);
      if (!values.length) return null;
      const { data } = await db.from("iocs").select("campaigns!inner(id, code, status)").in("value", values).limit(1);
      return (data?.[0]?.campaigns as { id: string; code: string; status: "confirmed" } | undefined) ?? null;
    },
    async findByBodyHash(hash) {
      const { data } = await db.from("messages").select("campaigns!inner(id, code, status)").eq("body_hash", hash).not("campaign_id", "is", null).limit(1);
      return (data?.[0]?.campaigns as { id: string; code: string; status: "confirmed" } | undefined) ?? null;
    },
    async findSimilarBody(body, min, days) {
      const { data } = await db.rpc("similar_campaign_by_body", { p_body: body, p_min: min, p_days: days });
      const hit = data?.[0];
      if (!hit) return null;
      const { data: c } = await db.from("campaigns").select("id, code, status").eq("id", hit.campaign_id).single();
      return c ? { ...c, similarity: hit.similarity } : null;
    },
    async findRelatedCampaign(q) {
      const { data } = await db
        .from("campaigns")
        .select("id, code, status, first_seen, campaign_domains(domains(registrar, nameserver))")
        .eq("institution_id", q.institutionId)
        .eq("tactic", q.tactic)
        .gte("first_seen", q.since.toISOString().slice(0, 10))
        .limit(20);
      const hit = (data ?? []).find((c) =>
        (c.campaign_domains ?? []).some((cd) => {
          const d = cd.domains as { registrar: string | null; nameserver: string | null } | null;
          return d && ((q.registrar && d.registrar === q.registrar) || (q.nameserver && d.nameserver === q.nameserver));
        }),
      );
      return hit ? { id: hit.id, code: hit.code, status: hit.status } : null;
    },
    async countUnlinkedByFingerprint(fp, hours) {
      const since = new Date(Date.now() - hours * 3_600_000).toISOString();
      const { data } = await db.from("messages").select("body_masked").is("campaign_id", null).gte("created_at", since).limit(2000);
      return (data ?? []).filter((m) => templateFingerprint(m.body_masked) === fp).length;
    },
    async createCandidate(fp, item) {
      if (opts.dryRun) return { id: "", code: "", status: "monitoring" };
      const year = new Date().getFullYear();
      const { data: last } = await db.from("campaigns").select("code").like("code", `C-${year}-%`).order("code", { ascending: false }).limit(1);
      const code = candidateCode(year, Number(last?.[0]?.code.split("-")[2] ?? 0) + 1);
      const { data } = await db
        .from("campaigns")
        .insert({ code, tactic: item.tactic ?? "unknown", institution_id: item.institutionId ?? null, status: "monitoring", source: "detected", summary: `Template ${fp}`, first_seen: item.seenAt.toISOString().slice(0, 10) })
        .select("id, code, status")
        .single();
      return data!;
    },
  };
}
