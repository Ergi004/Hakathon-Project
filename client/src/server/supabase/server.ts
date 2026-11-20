import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { getPublicSupabaseEnv } from "./env";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured");
    this.name = "SupabaseNotConfiguredError";
  }
}

/** Cookie-bound client using the publishable key. RLS applies as the signed-in user. */
export async function createClient() {
  const env = getPublicSupabaseEnv();
  if (!env) throw new SupabaseNotConfiguredError();
  // Auth is per request: supabase-js reads the clock (token expiry) and the
  // user's session, so never let this run during a (runtime) prerender.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
