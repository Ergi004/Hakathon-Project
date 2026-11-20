"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { check, staffAction } from "@/server/action";
import { audit } from "@/server/audit";

/** Link a business organization to the institution it represents (platform admin only). */
export async function linkOrgInstitution(input: unknown) {
  return staffAction("platform_admin", z.object({ orgId: z.uuid(), institutionId: z.uuid().nullable() }), input, async ({ orgId, institutionId }, ctx) => {
    check(await ctx.supabase.from("institutions").update({ organization_id: null }).eq("organization_id", orgId));
    if (institutionId) check(await ctx.supabase.from("institutions").update({ organization_id: orgId }).eq("id", institutionId));
    await audit({ actorId: ctx.user.id, action: "org.link_institution", entity: "organization", entityId: orgId, data: { institutionId } });
    updateTag("institutions");
    revalidatePath("/[locale]/admin/organizations", "page");
    return null;
  });
}
