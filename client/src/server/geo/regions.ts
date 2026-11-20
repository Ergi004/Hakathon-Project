import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { REGION_BY_CODE } from "@/lib/geo/regions";
import type { Database } from "@/types/database";

type Db = SupabaseClient<Database>;

/** code ↔ id maps for the regions loaded by `npm run seed:geo`. Empty when not loaded yet. */
export async function regionIdMaps(db: Db): Promise<{ idByCode: Map<string, string>; codeById: Map<string, string> }> {
  const { data } = await db.from("regions").select("id, code");
  const idByCode = new Map((data ?? []).map((r) => [r.code, r.id]));
  return { idByCode, codeById: new Map((data ?? []).map((r) => [r.id, r.code])) };
}

/** Resolves a municipality code chosen in the report form to its id (validated against the static list). */
export async function municipalityId(db: Db, code: string | undefined | null): Promise<string | null> {
  if (!code || REGION_BY_CODE.get(code)?.level !== "municipality") return null;
  const { data } = await db.from("regions").select("id").eq("code", code).eq("level", "municipality").maybeSingle();
  return data?.id ?? null;
}
