import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { tryAdmin } from "./db";
import { sha256 } from "./hash";

export const MAX_BODY = 64 * 1024;

export function apiError(status: number, code: string, message: string, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

const MAIL_ORIGINS = ["https://mail.google.com", "https://outlook.live.com", "https://outlook.office.com"];

/** CORS only for the extension and Gmail/Outlook origins on extension-facing routes (SPEC 12.3). */
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = [...MAIL_ORIGINS, ...(process.env.EXTENSION_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function preflight(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Reads and validates a JSON body, rejecting anything over `maxBytes` (default 64 KB). */
export async function readJson<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
  maxBytes: number = MAX_BODY,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; res: NextResponse }> {
  const limitText = `Body exceeds ${Math.round(maxBytes / 1024)} KB`;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { ok: false, res: apiError(413, "payload_too_large", limitText) };
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, res: apiError(413, "payload_too_large", limitText) };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, res: apiError(400, "bad_json", "Body is not valid JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: apiError(422, "validation_failed", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")) };
  return { ok: true, data: parsed.data };
}

export type ApiPrincipal =
  | { kind: "key"; keyId: string; orgId: string; scopes: string[] }
  | { kind: "install"; installId: string; userId: string | null; autoSubmit: boolean };

/** Bearer API key (mbk_…) or extension install token (mbi_…), both stored as SHA-256 hashes. */
export async function authenticate(req: NextRequest): Promise<ApiPrincipal | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 200) return null;
  const db = tryAdmin();
  if (!db) return null;
  const hash = sha256(token);
  if (token.startsWith("mbk_")) {
    const { data } = await db.from("api_keys").select("id, org_id, scopes, revoked_at").eq("key_hash", hash).maybeSingle();
    if (!data || data.revoked_at) return null;
    await db.rpc("api_usage_hit", { p_key: data.id });
    return { kind: "key", keyId: data.id, orgId: data.org_id, scopes: data.scopes };
  }
  if (token.startsWith("mbi_")) {
    const { data } = await db.from("extension_installs").select("id, user_id, auto_submit").eq("token_hash", hash).maybeSingle();
    if (!data) return null;
    await db.from("extension_installs").update({ last_seen: new Date().toISOString() }).eq("id", data.id);
    return { kind: "install", installId: data.id, userId: data.user_id, autoSubmit: data.auto_submit };
  }
  return null;
}

export function principalKey(p: ApiPrincipal): string {
  return p.kind === "key" ? `key:${p.keyId}` : `install:${p.installId}`;
}
