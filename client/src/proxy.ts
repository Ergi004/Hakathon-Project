import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { applyCookies, updateSession } from "@/server/supabase/proxy";

const intl = createIntlMiddleware(routing);

const PROTECTED = /^\/(sq|en)\/(citizen|business|soc|admin)(\/|$)/;

/**
 * Session refresh and locale routing only. Access control lives in RLS,
 * layout guards and every Server Action / Route Handler (SPEC 4).
 */
export default async function proxy(request: NextRequest) {
  const { signedIn, cookiesToSet } = await updateSession(request);

  const match = request.nextUrl.pathname.match(PROTECTED);
  if (match && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1]}/login`;
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return applyCookies(NextResponse.redirect(url), cookiesToSet);
  }

  return applyCookies(intl(request), cookiesToSet);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
