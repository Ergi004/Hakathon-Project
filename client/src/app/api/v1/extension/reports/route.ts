import { NextResponse, type NextRequest } from "next/server";
import { extensionReportSchema } from "@/lib/schemas/extension";
import { apiError, authenticate, corsHeaders, preflight, principalKey, readJson } from "@/server/api";
import { tryAdmin } from "@/server/db";
import { maskText } from "@/server/detection/masks";
import { limit } from "@/server/rate-limit";
import { createReport } from "@/server/reports";
import type { Json } from "@/types/database";

export const OPTIONS = preflight;

/** POST /api/v1/extension/reports → { reportId, protocol, deleteUntil } (SPEC 12.2-12.3). */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const who = await authenticate(req);
  if (!who || who.kind !== "install") return apiError(401, "unauthorized", "Install token required", cors);
  if (!(await limit(`ext-report:${principalKey(who)}`, 30, 3600)).allowed) return apiError(429, "rate_limited", "Too many reports", cors);
  const body = await readJson(req, extensionReportSchema);
  if (!body.ok) return body.res;
  const s = body.data.signals;
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable", cors);

  // Yellow sends indicators only; orange/red/darkred may carry the masked excerpt (SPEC 12.2).
  const withText = !s.indicatorsOnly && ["orange", "red", "darkred"].includes(s.flag);
  const masked = withText ? maskText([s.subject, s.bodyExcerpt].filter(Boolean).join("\n").slice(0, 900)) : undefined;
  const created = await createReport({
    category: "other",
    channel: s.channel ?? "email",
    text: masked,
    url: s.urls[0],
    sender: s.senderDomain,
    locale: "sq",
    source: "extension",
    reporterId: who.userId,
    consentSignal: true,
  });
  if (!created.ok) return apiError(500, "internal", "Could not create the report", cors);

  const masked_signals = { ...s, subject: s.subject ? maskText(s.subject) : undefined, bodyExcerpt: withText && s.bodyExcerpt ? maskText(s.bodyExcerpt) : undefined };
  await db.from("extension_reports").insert({ install_id: who.installId, report_id: created.data.id, signals: masked_signals as unknown as Json });
  await db.from("extension_installs").update({ consent_at: new Date().toISOString() }).eq("id", who.installId).is("consent_at", null);

  const deleteUntil = new Date(Date.now() + 10 * 60_000).toISOString();
  return NextResponse.json({ reportId: created.data.id, protocol: created.data.protocol, deleteUntil }, { status: 201, headers: cors });
}
