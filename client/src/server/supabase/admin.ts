import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SupabaseNotConfiguredError } from "./server";

/**
 * Secret-key client. Bypasses RLS: use only for public endpoints, jobs and
 * cross-tenant tasks, and write an audit_log entry for every such call (SPEC 4).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new SupabaseNotConfiguredError();
  return createSupabaseClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
