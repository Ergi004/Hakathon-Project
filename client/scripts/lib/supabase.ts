import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import { requireEnv } from "./env";

/** Secret-key client for offline scripts only (never imported by the app). */
export function scriptClient() {
  return createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ScriptClient = ReturnType<typeof scriptClient>;

export function chunks<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type Result = { data: unknown; error: { message: string } | null };
type Success<R extends Result> = NonNullable<Exclude<R, { error: { message: string } }>["data"]>;

/** Unwrap a Supabase result or throw with context (scripts only). */
export function must<R extends Result>(result: R, what: string): Success<R> {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as Success<R>;
}
