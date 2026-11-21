import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { getPublicSupabaseEnv } from "./env";

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refreshes the Supabase session. Updated cookies are written onto the request
 * (so Server Components see them) and returned so the caller can copy them onto
 * the final response. `signedIn` is only for cheap redirects: every layout,
 * Server Action and Route Handler re-checks with getUser().
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ signedIn: boolean; cookiesToSet: CookieToSet[] }> {
  const env = getPublicSupabaseEnv();
  const cookiesToSet: CookieToSet[] = [];
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.includes("auth-token"));
  if (!env || !hasSession) return { signedIn: false, cookiesToSet };

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value);
          cookiesToSet.push({ name, value, options });
        }
      },
    },
  });

  try {
    const { data } = await supabase.auth.getClaims();
    return { signedIn: Boolean(data?.claims?.sub), cookiesToSet };
  } catch {
    return { signedIn: false, cookiesToSet };
  }
}

export function applyCookies(response: NextResponse, cookiesToSet: CookieToSet[]) {
  for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
  return response;
}
