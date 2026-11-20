"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/result";
import { checkFormSchema, reportSchema, type AnalysisInputDto } from "@/lib/schemas/analysis";
import { getSessionUser } from "@/server/auth";
import { audit } from "@/server/audit";
import { runCheck, type CheckOutcome } from "@/server/checks";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";
import { createReport } from "@/server/reports";

export type CheckError = "invalid" | "rateLimited" | "error";

function toAnalysisInput(v: ReturnType<typeof checkFormSchema.parse>): AnalysisInputDto {
  switch (v.tab) {
    case "link":
      return { kind: "url", urls: [v.value], channel: v.channel ?? "web", locale: v.locale };
    case "qr":
      return { kind: "qr", urls: [v.value], channel: "qr", locale: v.locale };
    case "phone":
      return { kind: "phone", text: v.value, sender: v.value, channel: "call", locale: v.locale };
    default:
      return { kind: "text", text: v.value, sender: v.sender || undefined, channel: v.channel ?? "sms", locale: v.locale };
  }
}

/** Homepage and /check box (SPEC 7). 20 checks / 10 min / IP hash. Stores a hash only. */
export async function checkAction(input: unknown): Promise<ActionResult<CheckOutcome, CheckError>> {
  const parsed = checkFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const ip = ipHash(await headers());
  const rl = await limit(`check:${ip}`, 20, 600);
  if (!rl.allowed) return { ok: false, error: "rateLimited" };

  try {
    const session = await getSessionUser();
    const outcome = await runCheck(toAnalysisInput(parsed.data), {
      linkUserId: session?.profile.save_history ? session.user.id : null,
      explainWithLlm: true,
    });
    await audit({ actorId: session?.user.id ?? null, action: "check.create", entity: "check", entityId: outcome.checkId, data: { flag: outcome.result.flag }, ipHash: ip });
    return { ok: true, data: outcome };
  } catch (error) {
    console.error("checkAction failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "error" };
  }
}

export type ReportFromCheckResult = ActionResult<{ protocol: string; trackingToken: string }, "invalid" | "rateLimited" | "error">;

/** "Report this" on a result: the client re-sends what it checked; we mask it before storing. */
export async function reportFromCheck(input: unknown): Promise<ReportFromCheckResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const ip = ipHash(await headers());
  const rl = await limit(`report:${ip}`, 10, 3600);
  if (!rl.allowed) return { ok: false, error: "rateLimited" };

  const session = await getSessionUser();
  const created = await createReport({ ...parsed.data, source: "citizen_check", reporterId: session?.user.id ?? null }, { ipHash: ip });
  if (!created.ok) return { ok: false, error: "error" };
  return { ok: true, data: { protocol: created.data.protocol, trackingToken: created.data.trackingToken } };
}
