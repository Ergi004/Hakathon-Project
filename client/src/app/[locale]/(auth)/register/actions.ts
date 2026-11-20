"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/result";
import { signUpSchema } from "@/lib/schemas/auth";
import { canSkipVerification, confirmUserByEmail, createConfirmedUser } from "@/server/auth-direct";
import { ipHash } from "@/server/hash";
import { finalizeBusinessSignup } from "@/server/onboarding";
import { limit } from "@/server/rate-limit";
import { createClient, SupabaseNotConfiguredError } from "@/server/supabase/server";

export type SignUpError =
  | "invalidInput"
  | "weakPassword"
  | "emailTaken"
  | "confirmationRequired"
  | "rateLimited"
  | "signupDisabled"
  | "unavailable"
  | "generic";

function mapError(code: string | undefined): SignUpError {
  switch (code) {
    case "weak_password":
      return "weakPassword";
    case "user_already_exists":
    case "email_exists":
      return "emailTaken";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "rateLimited";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signupDisabled";
    case "unavailable":
      return "unavailable";
    default:
      return "generic";
  }
}

/**
 * Citizen or business sign-up with no email verification: the user is signed in
 * immediately and redirected to their dashboard (/citizen or /business).
 */
export async function signUp(input: unknown): Promise<ActionResult<undefined, SignUpError>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidInput" };
  const { accountType, email, password, fullName, orgName } = parsed.data;

  if (!(await limit(`signup:${ipHash(await headers())}`, 5, 3600)).allowed) return { ok: false, error: "rateLimited" };

  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    return { ok: false, error: error instanceof SupabaseNotConfiguredError ? "unavailable" : "generic" };
  }

  const locale = await getLocale();
  const metadata = {
    full_name: fullName || null,
    locale,
    account_type: accountType,
    ...(accountType === "business" ? { pending_org: { name: orgName } } : {}),
  };

  if (canSkipVerification()) {
    // Create the account already confirmed, then sign in with the same password.
    const created = await createConfirmedUser(email, password, metadata);
    if (created.error) {
      const err = mapError(created.error.code);
      // Existing account: let it through only if the password is right (that is just a sign-in).
      if (err !== "emailTaken") return { ok: false, error: err };
      await confirmUserByEmail(email);
    }
  } else {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) return { ok: false, error: mapError(error.code) };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { ok: false, error: "confirmationRequired" };
    if (error?.code === "invalid_credentials") return { ok: false, error: "emailTaken" };
    return { ok: false, error: "generic" };
  }

  const hasOrg = accountType === "business" && (await finalizeBusinessSignup(data.user, supabase));
  return redirect({ href: hasOrg ? "/business" : "/citizen", locale });
}
