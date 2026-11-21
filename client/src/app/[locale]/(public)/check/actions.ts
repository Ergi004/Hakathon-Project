"use server";

import { headers } from "next/headers";
import type { ActionResult } from "@/lib/result";
import { z } from "zod";
import { checkFormSchema, reportSchema, type AnalysisInputDto } from "@/lib/schemas/analysis";
import { parseImagePayload } from "@/server/detection/image-input";
import { screenshotToInput } from "@/server/detection/screenshot";
import { readScreenshot } from "@/server/llm";
import { getSessionUser } from "@/server/auth";
import { audit } from "@/server/audit";
import { runCheck, type CheckOutcome, type ScanDetected } from "@/server/checks";
import { parsePasted } from "@/server/detection/paste";
import { tryAdmin } from "@/server/db";
import { isReportable } from "@/lib/flags";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";
import { createReport } from "@/server/reports";

export type CheckError = "invalid" | "rateLimited" | "error";

type FormValue = ReturnType<typeof checkFormSchema.parse>;

/**
 * The message box takes anything: a full email (header lines are read), an SMS, a bare link or
 * a bare phone number. The other tabs keep their single-purpose behaviour.
 */
function toAnalysisInput(v: FormValue): { input: AnalysisInputDto; detected: ScanDetected } {
  if (v.tab === "message") {
    const p = parsePasted(v.value);
    switch (p.kind) {
      case "link":
        return { input: { kind: "url", urls: [p.body], channel: v.channel ?? "web", locale: v.locale }, detected: { kind: "link", sender: null, subject: null } };
      case "phone":
        return { input: { kind: "phone", text: p.body, sender: p.body, channel: "call", locale: v.locale }, detected: { kind: "phone", sender: null, subject: null } };
      case "email": {
        const sender = v.sender || p.sender;
        return {
          input: { kind: "text", text: p.body, subject: p.subject, sender, channel: "email", locale: v.locale, ...(p.replyTo ? { headers: { replyTo: p.replyTo } } : {}) },
          detected: { kind: "email", sender: sender ?? null, subject: p.subject ?? null },
        };
      }
      default:
        return {
          input: { kind: "text", text: p.body, sender: v.sender || undefined, channel: v.channel ?? "sms", locale: v.locale },
          detected: { kind: "message", sender: v.sender || null, subject: null },
        };
    }
  }
  const input = legacyInput(v);
  return { input, detected: { kind: v.tab === "link" ? "link" : v.tab === "qr" ? "qr" : "phone", sender: null, subject: null } };
}

function legacyInput(v: FormValue): AnalysisInputDto {
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
    const { input, detected } = toAnalysisInput(parsed.data);
    const outcome = await runCheck(input, {
      linkUserId: session?.profile.save_history ? session.user.id : null,
      explainWithLlm: true,
      detected,
    });
    await audit({ actorId: session?.user.id ?? null, action: "check.create", entity: "check", entityId: outcome.checkId, data: { flag: outcome.result.flag }, ipHash: ip });
    return { ok: true, data: outcome };
  } catch (error) {
    console.error("checkAction failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "error" };
  }
}

export type ImageCheckError = CheckError | "unreadable" | "unavailable";

const imageCheckSchema = z.object({
  /** Data URL of the screenshot, already downscaled and re-encoded (EXIF removed) on the device. */
  image: z.string().min(32).max(1_600_000),
  /** Links decoded on the device from QR codes in the screenshot. */
  qrUrls: z.array(z.string().trim().min(4).max(2048)).max(5).optional(),
  locale: z.enum(["sq", "en"]),
});

/**
 * Screenshot of an email or SMS (homepage "Screenshot" tab). Image recognition transcribes it,
 * then the normal scan runs on that text. Neither the image nor the text is stored: like every
 * check, only a fingerprint and the verdict are kept.
 */
export async function checkImageAction(input: unknown): Promise<ActionResult<CheckOutcome, ImageCheckError>> {
  const parsed = imageCheckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const image = parseImagePayload(parsed.data.image);
  if (!image) return { ok: false, error: "invalid" };

  const ip = ipHash(await headers());
  // Same budget as text checks, plus a tighter one: each image costs a recognition call.
  const [rl, rlImage] = await Promise.all([limit(`check:${ip}`, 20, 600), limit(`check-image:${ip}`, 8, 600)]);
  if (!rl.allowed || !rlImage.allowed) return { ok: false, error: "rateLimited" };
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) return { ok: false, error: "unavailable" };

  try {
    const read = await readScreenshot(image.data, image.mime);
    const qrUrls = parsed.data.qrUrls ?? [];
    // Recognition down (quota, timeout) is not the same as "no message in this image".
    if (read.status === "failed" && !qrUrls.length) return { ok: false, error: "unavailable" };
    const mapped = screenshotToInput(read.status === "ok" ? read.reading : null, qrUrls, parsed.data.locale);
    if (!mapped) return { ok: false, error: "unreadable" };
    const { input: scanInput, screenshot } = mapped;
    const session = await getSessionUser();
    const kind = screenshot.messageKind === "qr_only" ? "qr" : scanInput.channel === "email" ? "email" : "message";
    const outcome = await runCheck(scanInput, {
      linkUserId: session?.profile.save_history ? session.user.id : null,
      explainWithLlm: true,
      detected: { kind, sender: screenshot.sender, subject: screenshot.subject, screenshot },
    });
    await audit({ actorId: session?.user.id ?? null, action: "check.create", entity: "check", entityId: outcome.checkId, data: { flag: outcome.result.flag, image: true }, ipHash: ip });
    return { ok: true, data: outcome };
  } catch (error) {
    console.error("checkImageAction failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "error" };
  }
}

export type ReportFromCheckResult = ActionResult<{ protocol: string; trackingToken: string }, "invalid" | "rateLimited" | "notReportable" | "error">;

/** Report category from the stored pattern classification of the check. */
const CATEGORY_BY_SCAM: Record<string, ReturnType<typeof reportSchema.parse>["category"]> = {
  parcel_postal_fee: "parcel",
  fine_or_tax_refund: "fine",
  fake_bank: "bank",
};

/** "Report this" on a result: the client re-sends what it checked; we mask it before storing. */
export async function reportFromCheck(input: unknown): Promise<ReportFromCheckResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const ip = ipHash(await headers());
  const rl = await limit(`report:${ip}`, 10, 3600);
  if (!rl.allowed) return { ok: false, error: "rateLimited" };

  // Only a scan in the suspicious band or above can be reported from the checker. The stored
  // check row is the source of truth, not the client: a green result cannot be filed this way.
  const db = tryAdmin();
  if (!parsed.data.checkId || !db) return { ok: false, error: "notReportable" };
  const { data: check } = await db.from("checks").select("flag, scam_type, impersonated_brand").eq("id", parsed.data.checkId).maybeSingle();
  if (!check || !isReportable(check.flag)) return { ok: false, error: "notReportable" };
  const category =
    parsed.data.category !== "other" ? parsed.data.category
    : check.impersonated_brand === "e_albania" ? "eAlbania"
    : (check.scam_type && CATEGORY_BY_SCAM[check.scam_type]) || "other";

  const session = await getSessionUser();
  const created = await createReport({ ...parsed.data, category, source: "citizen_check", reporterId: session?.user.id ?? null }, { ipHash: ip });
  if (!created.ok) return { ok: false, error: "error" };
  return { ok: true, data: { protocol: created.data.protocol, trackingToken: created.data.trackingToken } };
}
