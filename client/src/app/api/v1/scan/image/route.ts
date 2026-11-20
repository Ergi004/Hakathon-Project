import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, authenticate, corsHeaders, preflight, principalKey } from "@/server/api";
import { audit } from "@/server/audit";
import { runCheck } from "@/server/checks";
import { parseImagePayload } from "@/server/detection/image-input";
import { readImageText } from "@/server/llm";
import { limit } from "@/server/rate-limit";

export const OPTIONS = preflight;

const bodySchema = z.object({
  image: z.string().min(32).max(1_600_000),
  mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]).optional(),
  locale: z.enum(["sq", "en"]).default("sq"),
  channel: z.enum(["sms", "email", "web", "other"]).default("sms"),
});

/** POST /api/v1/scan/image: Gemini reads the screenshot, then the text scorer decides. The image is not stored. */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const who = await authenticate(req);
  if (!who) return apiError(401, "unauthorized", "Send an API key or install token as a Bearer token", cors);
  if (who.kind === "key" && !who.scopes.includes("scan")) return apiError(403, "forbidden", "Key lacks the scan scope", cors);

  const rl = await limit(`scan:${principalKey(who)}`, 60, 3600);
  if (!rl.allowed) return apiError(429, "rate_limited", "60 scans per hour", { ...cors, "Retry-After": String(Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000)) });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError(400, "bad_json", "Body is not valid JSON", cors);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return apiError(422, "validation_failed", "Image payload is not valid", cors);
  const image = parseImagePayload(parsed.data.image, parsed.data.mime);
  if (!image) return apiError(422, "validation_failed", "Image must be a png, jpeg, webp, or gif screenshot", cors);

  const text = await readImageText(image.data, image.mime);
  if (!text) return apiError(422, "no_text", "No message could be read from the image", cors);

  try {
    const { result, checkId } = await runCheck(
      { kind: "text", text, channel: parsed.data.channel, locale: parsed.data.locale },
      { linkUserId: null },
    );
    await audit({ actorId: null, action: "api.scan", entity: "check", entityId: checkId, data: { via: who.kind, flag: result.flag, image: true } });
    return NextResponse.json({ ...result, checkId, transcribed: true }, { headers: { ...cors, "X-RateLimit-Remaining": String(rl.remaining) } });
  } catch {
    return apiError(500, "internal", "Analysis failed", cors);
  }
}
