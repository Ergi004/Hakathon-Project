"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { redirect as localeRedirect } from "@/i18n/navigation";
import { signInSchema } from "@/lib/schemas/auth";
import type { ActionResult } from "@/lib/result";
import { getSessionUser, homePathFor } from "@/server/auth";
import { createClient, SupabaseNotConfiguredError } from "@/server/supabase/server";

export type SignInError = "invalidInput" | "invalidCredentials" | "unavailable" | "generic";

export async function signIn(input: unknown): Promise<ActionResult<undefined, SignInError>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidInput" };

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return { ok: false, error: "unavailable" };
    return { ok: false, error: "generic" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: error.status === 400 ? "invalidCredentials" : "unavailable" };
  }

  // Area layouts re-check roles, so `next` only decides where to land.
  if (parsed.data.next) redirect(parsed.data.next);

  const ctx = await getSessionUser();
  const locale = await getLocale();
  return localeRedirect({ href: ctx ? await homePathFor(ctx) : "/citizen", locale });
}
