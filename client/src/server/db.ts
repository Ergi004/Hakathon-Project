import "server-only";

import { createAdminClient } from "./supabase/admin";

/**
 * Secret-key client or null when Supabase is not configured, so public pages
 * render empty states instead of crashing. Use only in server code.
 */
export function tryAdmin() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export type AdminClient = NonNullable<ReturnType<typeof tryAdmin>>;
