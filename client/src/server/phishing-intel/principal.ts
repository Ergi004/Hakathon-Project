import "server-only";

import type { NextRequest } from "next/server";
import { authenticate } from "@/server/api";
import { getSessionUser, hasMinRole } from "@/server/auth";
import type { AdminClient } from "@/server/db";

/**
 * Who is calling a /api/phishing-intelligence route. Reuses the existing auth:
 * extension install token (mbi_…), organisation API key (mbk_… with the "scan"
 * scope) or a Supabase session verified with getUser(). No new auth system.
 */
export type Principal =
  | { kind: "user"; userId: string; staff: boolean }
  | { kind: "key"; keyId: string; orgId: string }
  | { kind: "install"; installId: string; userId: string | null };

export interface Owner {
  key: string;
  userId: string | null;
  orgId: string | null;
  installId: string | null;
}

export async function resolvePrincipal(req: NextRequest): Promise<{ ok: true; principal: Principal } | { ok: false; status: 401 | 403; code: string }> {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) {
    const p = await authenticate(req);
    if (!p) return { ok: false, status: 401, code: "unauthorized" };
    if (p.kind === "key") {
      if (!p.scopes.includes("scan")) return { ok: false, status: 403, code: "forbidden" };
      return { ok: true, principal: { kind: "key", keyId: p.keyId, orgId: p.orgId } };
    }
    return { ok: true, principal: { kind: "install", installId: p.installId, userId: p.userId } };
  }
  const ctx = await getSessionUser();
  if (!ctx) return { ok: false, status: 401, code: "unauthorized" };
  return { ok: true, principal: { kind: "user", userId: ctx.user.id, staff: hasMinRole(ctx.profile.platform_role, "soc_analyst") } };
}

export function ownerOf(p: Principal): Owner {
  switch (p.kind) {
    case "user":
      return { key: `user:${p.userId}`, userId: p.userId, orgId: null, installId: null };
    case "key":
      return { key: `org:${p.orgId}`, userId: null, orgId: p.orgId, installId: null };
    case "install":
      return { key: `install:${p.installId}`, userId: p.userId, orgId: null, installId: p.installId };
  }
}

export function principalId(p: Principal): string {
  return p.kind === "user" ? `user:${p.userId}` : p.kind === "key" ? `key:${p.keyId}` : `install:${p.installId}`;
}

type ScanOwnerRow = { owner_user_id: string | null; owner_org_id: string | null; owner_install_id: string | null };

/**
 * Ownership check done in the route on top of RLS (hard rule 1). Users also see
 * scans from their own extension installs and their organisations; staff see all.
 */
export async function canAccess(db: AdminClient, p: Principal, row: ScanOwnerRow): Promise<boolean> {
  switch (p.kind) {
    case "key":
      return row.owner_org_id === p.orgId;
    case "install":
      return row.owner_install_id === p.installId;
    case "user": {
      if (p.staff || row.owner_user_id === p.userId) return true;
      if (row.owner_install_id) {
        const { data } = await db.from("extension_installs").select("id").eq("id", row.owner_install_id).eq("user_id", p.userId).maybeSingle();
        if (data) return true;
      }
      if (row.owner_org_id) {
        const { data } = await db.from("organization_members").select("org_id").eq("org_id", row.owner_org_id).eq("user_id", p.userId).maybeSingle();
        if (data) return true;
      }
      return false;
    }
  }
}

/** PostgREST filter string limiting a phishing_scans query to what the principal may list. */
export async function listFilter(db: AdminClient, p: Principal): Promise<string | null> {
  if (p.kind === "key") return `owner_org_id.eq.${p.orgId}`;
  if (p.kind === "install") return `owner_install_id.eq.${p.installId}`;
  if (p.staff) return null;
  const [{ data: installs }, { data: orgs }] = await Promise.all([
    db.from("extension_installs").select("id").eq("user_id", p.userId),
    db.from("organization_members").select("org_id").eq("user_id", p.userId),
  ]);
  const parts = [`owner_user_id.eq.${p.userId}`];
  if (installs?.length) parts.push(`owner_install_id.in.(${installs.map((i) => i.id).join(",")})`);
  if (orgs?.length) parts.push(`owner_org_id.in.(${orgs.map((o) => o.org_id).join(",")})`);
  return parts.join(",");
}
