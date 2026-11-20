"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/result";
import { signUpSchema } from "@/lib/schemas/auth";
import { appUrl } from "@/server/app-url";
import { createConfirmedUser, skipEmailConfirmation } from "@/server/auth-bypass";
import { ipHash } from "@/server/hash";
import { finalizeBusinessSignup } from "@/server/onboarding";
import { limit } from "@/server/rate-limit";
import { createClient, SupabaseNotConfiguredError } from "@/server/supabase/server";

export type SignUpError = "invalidInput" | "weakPassword" | "rateLimited" | "signupDisabled" | "unavailable" | "generic";

/**
 * Citizen or business sign-up. Always returns the same "check your email"
 * result for new and existing addresses, so the form cannot be used to find
 * out who has an account.
 */
export async function signUp(input: unknown): Promise<ActionResult<{ status: "check_email" }, SignUpError>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidInput" };
  const { accountType, email, password, fullName, orgName } = parsed.data;

  const rl = await limit(`signup:${ipHash(await headers())}`, 5, 3600);
  if (!rl.allowed) return { ok: false, error: "rateLimited" };

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

  // TEMPORARY (AUTH_SKIP_EMAIL_CONFIRMATION=true): create the account confirmed and sign in now.
  if (skipEmailConfirmation()) {
    const created = await createConfirmedUser(email, password, metadata);
    if (created.error && created.error.code !== "email_exists" && created.error.code !== "user_already_exists") {
      return { ok: false, error: created.error.code === "weak_password" ? "weakPassword" : created.error.code === "unavailable" ? "unavailable" : "generic" };
    }
    const signedIn = await supabase.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.user) return { ok: true, data: { status: "check_email" } };
    const hasOrg = accountType === "business" && (await finalizeBusinessSignup(signedIn.data.user));
    return redirect({ href: hasOrg ? "/business" : "/citizen", locale });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await appUrl()}/${locale}/auth/confirm`,
      data: metadata,
    },
  });

  if (error) {
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        return { ok: true, data: { status: "check_email" } };
      case "weak_password":
        return { ok: false, error: "weakPassword" };
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return { ok: false, error: "rateLimited" };
      case "signup_disabled":
      case "email_provider_disabled":
        return { ok: false, error: "signupDisabled" };
      default:
        return { ok: false, error: "generic" };
    }
  }

  // Email confirmation turned off in the project: the user is signed in already.
  if (data.session && data.user) {
    const hasOrg = accountType === "business" && (await finalizeBusinessSignup(data.user));
    return redirect({ href: hasOrg ? "/business" : "/citizen", locale });
  }
  return { ok: true, data: { status: "check_email" } };
}
