"use server";

import { z } from "zod";
import { recordSimEvent } from "@/server/simulation";

export async function reportSimulation(input: unknown) {
  const p = z.object({ simId: z.uuid(), token: z.string().max(64) }).safeParse(input);
  if (p.success) await recordSimEvent(p.data.simId, p.data.token, "reported");
  return { ok: true as const };
}
