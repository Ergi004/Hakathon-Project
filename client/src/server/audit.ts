import "server-only";

import type { Json } from "@/types/database";
import { createAdminClient } from "./supabase/admin";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  data?: Record<string, Json | undefined>;
  ipHash?: string | null;
}

/**
 * Append to audit_log with the secret key (no client can write it, SPEC 5).
 * Never throws: an audit failure is logged server-side, not shown to users.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await createAdminClient().from("audit_log").insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      data: (entry.data ?? {}) as Json,
      ip_hash: entry.ipHash ?? null,
    });
    if (error) console.error("audit_log insert failed", error.message);
  } catch (error) {
    console.error("audit_log unavailable", error instanceof Error ? error.message : error);
  }
}
