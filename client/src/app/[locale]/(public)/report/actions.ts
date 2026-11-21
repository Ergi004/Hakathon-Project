"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/result";
import { reportSchema } from "@/lib/schemas/analysis";
import { getSessionUser } from "@/server/auth";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";
import { createReport } from "@/server/reports";

/** SPEC 7 /report: 10 reports / hour / IP hash, honeypot, masked storage. */
export async function submitReport(input: unknown): Promise<ActionResult<{ protocol: string; trackingToken: string; score: number; flag: string; scan: { scanId: string; token: string } | null }, "invalid" | "rateLimited" | "error">> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const ip = ipHash(await headers());
  if (!(await limit(`report:${ip}`, 10, 3600)).allowed) return { ok: false, error: "rateLimited" };
  const session = await getSessionUser();
  const res = await createReport({ ...parsed.data, source: "citizen_report", reporterId: session?.user.id ?? null }, { ipHash: ip });
  return res.ok ? { ok: true, data: { protocol: res.data.protocol, trackingToken: res.data.trackingToken, score: res.data.score, flag: res.data.flag, scan: res.data.scan } } : { ok: false, error: "error" };
}
