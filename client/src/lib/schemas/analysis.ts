import { z } from "zod";

export const CHANNELS = ["sms", "email", "social", "web", "qr", "call", "other"] as const;
export const authResult = z.enum(["pass", "fail", "none"]);

/** SPEC 6.2 AnalysisInput, validated on every server entry point. */
export const analysisInputSchema = z
  .object({
    kind: z.enum(["url", "text", "phone", "email_signals", "qr"]),
    text: z.string().max(10_000).optional(),
    urls: z.array(z.string().max(2048)).max(50).optional(),
    sender: z.string().max(320).optional(),
    subject: z.string().max(500).optional(),
    headers: z
      .object({
        spf: authResult.optional(),
        dkim: authResult.optional(),
        dmarc: authResult.optional(),
        dmarcPolicy: z.enum(["none", "quarantine", "reject"]).optional(),
        replyTo: z.string().max(320).optional(),
      })
      .optional(),
    attachments: z
      .array(z.object({ name: z.string().max(255), mime: z.string().max(255), size: z.number().int().min(0) }))
      .max(20)
      .optional(),
    channel: z.enum(CHANNELS),
    locale: z.enum(["sq", "en"]),
  })
  .refine((v) => Boolean(v.text?.trim() || v.urls?.length || v.sender?.trim()), { message: "empty", path: ["text"] });

export type AnalysisInputDto = z.infer<typeof analysisInputSchema>;

/** The website check box: one value per tab. */
export const checkFormSchema = z.object({
  tab: z.enum(["link", "message", "phone", "qr"]),
  value: z.string().trim().min(1).max(10_000),
  channel: z.enum(CHANNELS).optional(),
  sender: z.string().trim().max(320).optional(),
  locale: z.enum(["sq", "en"]),
});
export type CheckFormInput = z.infer<typeof checkFormSchema>;

export const REPORT_CATEGORIES = ["fine", "bank", "parcel", "job", "eAlbania", "prize", "investment", "other"] as const;

/** SPEC 7 /report wizard and POST /api/v1/reports. */
export const reportSchema = z
  .object({
    category: z.enum(REPORT_CATEGORIES),
    channel: z.enum(CHANNELS),
    text: z.string().trim().max(10_000).optional(),
    url: z.string().trim().max(2048).optional(),
    sender: z.string().trim().max(320).optional(),
    lostMoney: z.boolean().optional(),
    contact: z.string().trim().max(254).optional(),
    contactConsent: z.boolean().optional(),
    checkId: z.uuid().optional(),
    /** Consent to send the link to security analysis services (tier B deep scan). */
    deepConsent: z.boolean().optional(),
    /** Optional municipality the citizen chose (OCHA P-code, e.g. AL0705). Never inferred. */
    regionCode: z.string().regex(/^AL\d{4}$/).optional(),
    /** Honeypot: humans never fill it. */
    website: z.string().max(0).optional(),
    locale: z.enum(["sq", "en"]),
  })
  .refine((v) => Boolean(v.text || v.url || v.sender), { message: "empty", path: ["text"] })
  .refine((v) => !v.contact || v.contactConsent === true, { message: "consent", path: ["contactConsent"] });
export type ReportInput = z.infer<typeof reportSchema>;

export const trackSchema = z.object({
  protocol: z.string().trim().regex(/^SOC-\d{4}\/\d{6}$/),
  token: z.string().trim().min(20).max(100),
});
