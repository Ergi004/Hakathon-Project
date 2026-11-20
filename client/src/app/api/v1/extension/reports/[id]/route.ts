import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, authenticate, corsHeaders, preflight } from "@/server/api";
import { audit } from "@/server/audit";
import { tryAdmin } from "@/server/db";

export const OPTIONS = preflight;

/** DELETE /api/v1/extension/reports/{id}: undo within 10 minutes with the same install token. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cors = corsHeaders(req);
  const who = await authenticate(req);
  if (!who || who.kind !== "install") return apiError(401, "unauthorized", "Install token required", cors);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return apiError(400, "invalid", "Bad id", cors);
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable", cors);

  const { data: link } = await db.from("extension_reports").select("report_id, created_at, reports(message_id)").eq("report_id", id).eq("install_id", who.installId).maybeSingle();
  if (!link) return apiError(404, "not_found", "No such report for this install", cors);
  if (Date.now() - Date.parse(link.created_at) > 10 * 60_000) return apiError(409, "too_late", "Reports can be deleted within 10 minutes", cors);

  const messageId = (link.reports as { message_id: string | null } | null)?.message_id;
  await db.from("reports").delete().eq("id", id);
  if (messageId) await db.from("messages").delete().eq("id", messageId);
  await audit({ actorId: who.userId, action: "extension.report.delete", entity: "report", entityId: id });
  return new NextResponse(null, { status: 204, headers: cors });
}
