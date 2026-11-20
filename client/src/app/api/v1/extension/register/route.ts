import { NextResponse, type NextRequest } from "next/server";
import { registerSchema } from "@/lib/schemas/extension";
import { apiError, corsHeaders, preflight, readJson } from "@/server/api";
import { audit } from "@/server/audit";
import { tryAdmin } from "@/server/db";
import { ipHash, randomToken, sha256 } from "@/server/hash";
import { limit } from "@/server/rate-limit";

export const OPTIONS = preflight;

/** POST /api/v1/extension/register → { installToken } (5 / hour / IP hash). */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  if (!(await limit(`ext-register:${ipHash(req.headers)}`, 5, 3600)).allowed) return apiError(429, "rate_limited", "5 registrations per hour", cors);
  const body = await readJson(req, registerSchema);
  if (!body.ok) return body.res;
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable", cors);

  const token = `mbi_${randomToken()}`;
  const { data, error } = await db
    .from("extension_installs")
    .upsert({ install_hash: sha256(body.data.installHash), version: body.data.version, token_hash: sha256(token), last_seen: new Date().toISOString() }, { onConflict: "install_hash" })
    .select("id")
    .single();
  if (error) return apiError(500, "internal", "Could not register", cors);
  await audit({ actorId: null, action: "extension.register", entity: "extension_install", entityId: data.id, data: { version: body.data.version } });
  return NextResponse.json({ installToken: token }, { status: 201, headers: cors });
}
