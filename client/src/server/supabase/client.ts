"use client";

import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/** Browser client: publishable key only. Used for Realtime and RLS-allowed reads. */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createSsrBrowserClient<Database>(url, key);
}
