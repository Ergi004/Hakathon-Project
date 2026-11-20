import "server-only";

import type { z } from "zod";
import { ForbiddenError, requireRole, requireUser, type Ctx, type StaffRole } from "./auth";

export type Res<T = null> = { ok: true; data: T } | { ok: false; error: "invalid" | "forbidden" | "notFound" | "conflict" | "error"; message?: string };

export class ActionError extends Error {
  constructor(public code: "invalid" | "notFound" | "conflict" | "forbidden", message?: string) {
    super(message ?? code);
  }
}

/**
 * Server Action wrapper (SPEC 13.1): zod parse, role guard from the database,
 * typed result. Never leaks raw database errors to the client.
 */
export async function staffAction<S extends z.ZodType, T>(
  min: StaffRole,
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>, ctx: Ctx) => Promise<T>,
): Promise<Res<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", message: parsed.error.issues[0]?.message };
  try {
    const ctx = await requireRole(min);
    return { ok: true, data: await fn(parsed.data, ctx) };
  } catch (e) {
    return toError(e);
  }
}

/** Same for signed-in users without a staff role (citizen/business actions do their own org checks). */
export async function userAction<S extends z.ZodType, T>(schema: S, input: unknown, fn: (data: z.infer<S>, ctx: Ctx) => Promise<T>): Promise<Res<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", message: parsed.error.issues[0]?.message };
  try {
    const ctx = await requireUser();
    return { ok: true, data: await fn(parsed.data, ctx) };
  } catch (e) {
    return toError(e);
  }
}

function toError(e: unknown): Res<never> {
  if (e instanceof ForbiddenError) return { ok: false, error: "forbidden" };
  if (e instanceof ActionError) return { ok: false, error: e.code, message: e.message };
  // redirect() from guards must propagate
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
  console.error("action failed", e instanceof Error ? e.message : e);
  return { ok: false, error: "error" };
}

/** Throw on a Supabase error so staffAction maps it to a typed result. */
type DbResult = { data: unknown; error: { message: string; code?: string } | null };
type DbSuccess<R extends DbResult> = Exclude<R, { error: { message: string } }>["data"];

export function check<R extends DbResult>(res: R, what = "db"): DbSuccess<R> {
  if (res.error) {
    if (res.error.code === "23505") throw new ActionError("conflict", what);
    if (res.error.code === "42501") throw new ActionError("forbidden", what);
    throw new Error(`${what}: ${res.error.message}`);
  }
  return res.data as DbSuccess<R>;
}
