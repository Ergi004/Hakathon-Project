import type { EmailOtpType } from "@supabase/supabase-js";
import { hasLocale } from "next-intl";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { safeNextPath } from "@/lib/schemas/auth";
import { finalizeBusinessSignup } from "@/server/onboarding";
import { createClient } from "@/server/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "invite", "magiclink", "recovery", "email_change"];

/**
 * Landing point for Supabase email links (PKCE `code` or `token_hash`) and,
 * later, OAuth providers such as Google. Establishes the session, finishes a
 * pending business sign-up, then sends the user to their area.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath.parse(url.searchParams.get("next") ?? undefined);

  const fail = () => NextResponse.redirect(new URL(`/${locale}/login?error=confirm`, url.origin));

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return fail();
  }

  let user = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
    user = data.user;
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail();
    user = data.user;
  }
  if (!user) return fail();

  const hasOrg = await finalizeBusinessSignup(user, supabase);
  const target = next ?? `/${locale}/${hasOrg ? "business" : "citizen"}`;
  return NextResponse.redirect(new URL(target, url.origin));
}
