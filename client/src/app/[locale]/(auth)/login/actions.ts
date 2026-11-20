"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { redirect as localeRedirect } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/result";
import { signInSchema } from "@/lib/schemas/auth";
import { getSessionUser, homePathFor } from "@/server/auth";
import { canSkipVerification, confirmUserByEmail } from "@/server/auth-direct";
import { finalizeBusinessSignup } from "@/server/onboarding";
import { createClient, SupabaseNotConfiguredError } from "@/server/supabase/server";

export type SignInError = "invalidInput" | "invalidCredentials" | "confirmationRequired" | "unavailable" | "generic";

export async function signIn(input: unknown): Promise<ActionResult<undefined, SignInError>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidInput" };
  const { email, password, next } = parsed.data;

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    return { ok: false, error: error instanceof SupabaseNotConfiguredError ? "unavailable" : "generic" };
  }

  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  // Accounts created before verification was removed: confirm them and retry once.
  if (error?.code === "email_not_confirmed" && canSkipVerification() && (await confirmUserByEmail(email))) {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) {
    if (error.code === "email_not_confirmed") return { ok: false, error: "confirmationRequired" };
    return { ok: false, error: error.status === 400 ? "invalidCredentials" : "unavailable" };
  }

  if (data.user) await finalizeBusinessSignup(data.user, supabase);

  // Area layouts re-check roles, so `next` only decides where to land.
  if (next) redirect(next);

  const ctx = await getSessionUser();
  const locale = await getLocale();
  return localeRedirect({ href: ctx ? await homePathFor(ctx) : "/citizen", locale });
}
