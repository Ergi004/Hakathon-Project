import "server-only";

import type { Enums } from "@/types/database";
import { tryAdmin } from "./db";
import { safeEqualHex, sha256 } from "./hash";

export interface PublicTimeline {
  protocol: string;
  status: Enums<"report_status">;
  createdAt: string;
  steps: { status: Enums<"report_status">; at: string }[];
  campaignCode: string | null;
}

/**
 * Status for /track and GET /api/v1/reports/{protocol}. The token is compared
 * as a SHA-256 hash in constant time; only public statuses are returned, never
 * notes, assignees or other reports.
 */
export async function getPublicTimeline(protocol: string, token: string): Promise<PublicTimeline | null> {
  const db = tryAdmin();
  if (!db) return null;
  const { data: r } = await db
    .from("reports")
    .select("id, protocol, status, created_at, tracking_token_hash, campaigns(code, is_public)")
    .eq("protocol", protocol)
    .maybeSingle();
  if (!r?.tracking_token_hash || !safeEqualHex(r.tracking_token_hash, sha256(token))) return null;

  const { data: events } = await db
    .from("report_events")
    .select("kind, data, created_at")
    .eq("report_id", r.id)
    .eq("kind", "status_change")
    .order("created_at");

  const steps: PublicTimeline["steps"] = [{ status: "received", at: r.created_at }];
  for (const e of events ?? []) {
    const to = (e.data as { to?: Enums<"report_status"> } | null)?.to;
    if (to) steps.push({ status: to, at: e.created_at });
  }
  const camp = r.campaigns as { code: string; is_public: boolean } | null;
  return { protocol: r.protocol, status: r.status, createdAt: r.created_at, steps, campaignCode: camp?.is_public ? camp.code : null };
}
