import { z } from "zod";

/** Request contract for POST /api/phishing-intelligence/scan (docs/PHISHING-INTEL.md §API). */

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().max(255).default("application/octet-stream"),
  size: z.number().int().min(0).max(50 * 1024 * 1024).default(0),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  sha1: z.string().regex(/^[a-f0-9]{40}$/i).optional(),
  md5: z.string().regex(/^[a-f0-9]{32}$/i).optional(),
});

const optionsSchema = z
  .object({
    useVirusTotal: z.boolean().default(true),
    aiMode: z.enum(["off", "local", "hybrid"]).default("hybrid"),
    allowCloudAnalysis: z.boolean().default(true),
    threatAttribution: z.boolean().default(true),
    locale: z.enum(["sq", "en"]).default("sq"),
  })
  .default({ useVirusTotal: true, aiMode: "hybrid", allowCloudAnalysis: true, threatAttribution: true, locale: "sq" });

const emailSchema = z
  .object({
    /** Full RFC 822 / EML message. When present, the structured fields below are ignored. */
    raw: z.string().max(2_000_000).optional(),
    subject: z.string().max(998).optional(),
    sender: z.string().max(320).optional(),
    replyTo: z.string().max(320).optional(),
    returnPath: z.string().max(320).optional(),
    /** Raw header block as the webmail exposes it ("Show original"). */
    headers: z.string().max(200_000).optional(),
    body: z.string().max(100_000).optional(),
    html: z.string().max(500_000).optional(),
    urls: z.array(z.string().max(2048)).max(200).default([]),
    attachments: z.array(attachmentSchema).max(50).default([]),
  })
  .refine((e) => Boolean(e.raw || e.body?.trim() || e.html || e.subject || e.urls.length || e.attachments.length), {
    message: "Provide raw EML or at least one of body, html, subject, urls, attachments",
  });

const smsSchema = z.object({
  text: z.string().trim().min(1).max(5_000),
  sender: z.string().trim().max(64).optional(),
  receivedAt: z.iso.datetime().optional(),
});

export const EMAIL_SOURCES = ["gmail", "outlook", "webmail", "eml", "msg", "api"] as const;
export const SMS_SOURCES = ["manual_input", "sms_export", "messages_web", "api"] as const;

export const scanRequestSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("EMAIL"), source: z.enum(EMAIL_SOURCES), email: emailSchema, options: optionsSchema }),
  z.object({ channel: z.literal("SMS"), source: z.enum(SMS_SOURCES).default("manual_input"), message: smsSchema, options: optionsSchema }),
]);
export type ScanRequest = z.infer<typeof scanRequestSchema>;
export type ScanOptions = z.infer<typeof optionsSchema>;

/** POST /smishing/scan: same body without the channel field. */
export const smishingRequestSchema = z.object({
  source: z.enum(SMS_SOURCES).default("manual_input"),
  message: smsSchema,
  options: optionsSchema,
});

export const scanListQuerySchema = z.object({
  channel: z.enum(["EMAIL", "SMS", "email", "sms"]).optional(),
  status: z.enum(["queued", "processing", "completed", "partial", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  before: z.iso.datetime({ offset: true }).optional(),
});

export const iocQuerySchema = z.object({
  type: z.enum(["url", "domain", "ip", "file_hash", "email", "phone_number", "short_code", "PHONE", "URL", "DOMAIN", "IP", "FILE_HASH", "EMAIL"]).optional(),
  q: z.string().trim().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const idParamSchema = z.uuid();
