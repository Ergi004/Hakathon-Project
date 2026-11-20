import "server-only";

import type { User } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { orgSlug, pendingOrgSchema } from "@/lib/schemas/auth";
import { audit } from "./audit";
import { createAdminClient } from "./supabase/admin";

/**
 * Finish a business sign-up (SPEC 4: "sign-up creates an organization and makes
 * the user owner"). Runs only for a verified session user, after the email is
 * confirmed, so nobody can create an organization for an address they don't
 * control. Idempotent: does nothing once the user belongs to an organization.
 * Returns true when the user has (or now has) an organization.
 */
export async function finalizeBusinessSignup(user: User): Promise<boolean> {
  const pending = pendingOrgSchema.safeParse(user.user_metadata?.pending_org);
  if (!pending.success) return false;

  try {
    const admin = createAdminClient();
    const { count, error: countError } = await admin
      .from("organization_members")
      .select("org_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (countError) throw countError;

    if (!count) {
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ type: "business", name: pending.data.name, slug: orgSlug(pending.data.name, randomBytes(3).toString("hex")) })
        .select("id, slug")
        .single();
      if (orgError) throw orgError;

      const { error: memberError } = await admin
        .from("organization_members")
        .insert({ org_id: org.id, user_id: user.id, role: "owner" });
      if (memberError) {
        await admin.from("organizations").delete().eq("id", org.id);
        throw memberError;
      }

      await audit({
        actorId: user.id,
        action: "org.create",
        entity: "organization",
        entityId: org.id,
        data: { slug: org.slug, via: "signup" },
      });
    }

    // Clear the marker only after success, so a failure is retried on next sign-in.
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, pending_org: null },
    });
    return true;
  } catch (error) {
    console.error("business sign-up finalisation failed", error instanceof Error ? error.message : error);
    return false;
  }
}
