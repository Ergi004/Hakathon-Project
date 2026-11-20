import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import type { Database, Enums, Tables } from "@/types/database";
import { createClient, SupabaseNotConfiguredError } from "./supabase/server";

export type Profile = Tables<"profiles">;
export type PlatformRole = Enums<"app_platform_role">;
export type OrgRole = Enums<"org_member_role">;
export type StaffRole = Exclude<PlatformRole, "user">;

export interface Ctx {
  user: User;
  profile: Profile;
  supabase: SupabaseClient<Database>;
}

export interface OrgCtx extends Ctx {
  org: Pick<Tables<"organizations">, "id" | "name" | "slug" | "type">;
  orgRole: OrgRole;
}

export class ForbiddenError extends Error {
  constructor(message = "forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const ACTIVE_ORG_COOKIE = "mbr_org";

const ROLE_RANK: Record<PlatformRole, number> = {
  user: 0,
  soc_analyst: 1,
  soc_lead: 2,
  platform_admin: 3,
};

export function hasMinRole(role: PlatformRole, min: PlatformRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/**
 * Verifies the session with the Auth server (getUser, never a bare cookie) and
 * loads the profile from the database. Returns null when signed out.
 * Cached per request.
 */
export const getSessionUser = cache(async (): Promise<Ctx | null> => {
  let supabase: SupabaseClient<Database>;
  try {
    supabase = await createClient();
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null;
    throw error;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return { user, profile, supabase };
});

async function redirectToLogin(): Promise<never> {
  const locale = await getLocale();
  return redirect({ href: "/login", locale });
}

/** Signed-in user or redirect to the login page. */
export async function requireUser(): Promise<Ctx> {
  const ctx = await getSessionUser();
  if (!ctx) return redirectToLogin();
  return ctx;
}

/** Staff guard. Throws ForbiddenError when the database role is below `min`. */
export async function requireRole(min: StaffRole): Promise<Ctx> {
  const ctx = await requireUser();
  if (!hasMinRole(ctx.profile.platform_role, min)) throw new ForbiddenError();
  return ctx;
}

/** Organization guard. Membership and role are read from the database. */
export async function requireOrgRole(orgId: string, roles: readonly OrgRole[]): Promise<OrgCtx> {
  const ctx = await requireUser();
  const { data } = await ctx.supabase
    .from("organization_members")
    .select("role, organizations!inner(id, name, slug, type)")
    .eq("org_id", orgId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  if (!data || !roles.includes(data.role)) throw new ForbiddenError();
  return { ...ctx, org: data.organizations, orgRole: data.role };
}

export const ALL_ORG_ROLES: readonly OrgRole[] = [
  "owner",
  "admin",
  "security",
  "comms",
  "finance",
  "viewer",
  "contact",
];

/**
 * The active organization comes from a cookie but is always re-validated
 * against organization_members. Falls back to the user's first membership.
 */
export async function requireActiveOrg(roles: readonly OrgRole[] = ALL_ORG_ROLES): Promise<OrgCtx> {
  const ctx = await requireUser();
  const cookieOrg = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;

  const { data: memberships } = await ctx.supabase
    .from("organization_members")
    .select("org_id, created_at")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: true });

  const ids = (memberships ?? []).map((m) => m.org_id);
  const orgId = cookieOrg && ids.includes(cookieOrg) ? cookieOrg : ids[0];
  if (!orgId) throw new ForbiddenError("no_org");
  return requireOrgRole(orgId, roles);
}

/** Where a signed-in user lands by default. */
export async function homePathFor(ctx: Ctx): Promise<"/soc" | "/business" | "/citizen"> {
  if (hasMinRole(ctx.profile.platform_role, "soc_analyst")) return "/soc";
  const { count } = await ctx.supabase
    .from("organization_members")
    .select("org_id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id);
  return count && count > 0 ? "/business" : "/citizen";
}

/** For layouts: turns ForbiddenError into a redirect to the user's own area. */
export async function guardOrRedirect<T>(guard: () => Promise<T>): Promise<T> {
  try {
    return await guard();
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    const ctx = await requireUser();
    const locale = await getLocale();
    return redirect({ href: await homePathFor(ctx), locale });
  }
}
