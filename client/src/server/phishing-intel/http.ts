import "server-only";

import { after, NextResponse, type NextRequest } from "next/server";
import type { ScanRequest } from "@/lib/schemas/phishing-intel";
import { apiError, corsHeaders } from "@/server/api";
import { audit } from "@/server/audit";
import { tryAdmin, type AdminClient } from "@/server/db";
import { limit } from "@/server/rate-limit";
import { canAccess, ownerOf, principalId, resolvePrincipal, type Principal } from "./principal";
import { createScan, parseRequest, processScan } from "./scan-service";

export const MAX_SCAN_BODY = 2_500_000;

export function enabled(): boolean {
  return process.env.PHISHING_INTEL_ENABLED !== "false";
}

type Guarded = { ok: true; principal: Principal; db: AdminClient; cors: Record<string, string> } | { ok: false; res: NextResponse };

/** Feature flag → Supabase → principal. Every route starts here. */
export async function guard(req: NextRequest): Promise<Guarded> {
  const cors = corsHeaders(req);
  if (!enabled()) return { ok: false, res: apiError(404, "not_found", "Phishing intelligence is disabled", cors) };
  const db = tryAdmin();
  if (!db) return { ok: false, res: apiError(503, "unavailable", "Supabase not configured", cors) };
  const who = await resolvePrincipal(req);
  if (!who.ok) {
    return { ok: false, res: apiError(who.status, who.code, who.status === 401 ? "Sign in, or send an install token or API key with the scan scope as a Bearer token" : "API key lacks the scan scope", cors) };
  }
  return { ok: true, principal: who.principal, db, cors };
}

/** Loads a scan and enforces ownership (404 rather than 403, so ids cannot be probed). */
export async function loadOwnedScan(g: Extract<Guarded, { ok: true }>, scanId: string) {
  const { data } = await g.db.from("phishing_scans").select("*").eq("id", scanId).maybeSingle();
  if (!data || !(await canAccess(g.db, g.principal, data))) return null;
  return data;
}

/** POST /scan and /smishing/scan: validate → parse → create (idempotent) → 202 → process after the response. */
export async function submitScan(req: NextRequest, g: Extract<Guarded, { ok: true }>, body: ScanRequest) {
  const max = Number(process.env.PI_SCAN_RATE_PER_HOUR) || 30;
  const rl = await limit(`pi-scan:${principalId(g.principal)}`, max, 3600);
  if (!rl.allowed) {
    return apiError(429, "rate_limited", `${max} scans per hour`, { ...g.cors, "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) });
  }

  let msg;
  try {
    msg = await parseRequest(body);
  } catch {
    return apiError(422, "unparseable_message", "The email could not be parsed", g.cors);
  }

  let scan;
  try {
    scan = await createScan(g.db, ownerOf(g.principal), body, msg, req.headers.get("idempotency-key"));
  } catch {
    return apiError(500, "internal", "Could not create the scan", g.cors);
  }

  if (!scan.duplicate) {
    const db = g.db;
    after(() => processScan(db, scan.id, msg));
    await audit({ actorId: g.principal.kind === "user" ? g.principal.userId : null, action: "phishing_intel.scan", entity: "phishing_scan", entityId: scan.id, data: { via: g.principal.kind, channel: msg.channel, source: msg.source } });
  }

  return NextResponse.json(
    {
      scanId: scan.id,
      status: scan.status,
      duplicate: scan.duplicate,
      message: scan.duplicate ? "This message was already submitted" : "Message submitted for analysis",
      links: { status: `/api/phishing-intelligence/scans/${scan.id}`, report: `/api/phishing-intelligence/reports/${scan.id}` },
    },
    { status: scan.duplicate ? 200 : 202, headers: { ...g.cors, "X-RateLimit-Remaining": String(rl.remaining) } },
  );
}
