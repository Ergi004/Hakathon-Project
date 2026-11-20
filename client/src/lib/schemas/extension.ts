import { z } from "zod";
import { authResult } from "./analysis";

export const registerSchema = z.object({
  installHash: z.string().min(16).max(128),
  version: z.string().max(32),
});

/** SPEC 12.2 signal report: masked, never the full email or the user's identity. */
export const signalReportSchema = z.object({
  subject: z.string().max(300).optional(),
  bodyExcerpt: z.string().max(600).optional(),
  urls: z.array(z.string().max(2048)).max(50).default([]),
  senderDomain: z.string().max(253).optional(),
  auth: z.object({ spf: authResult.optional(), dkim: authResult.optional(), dmarc: authResult.optional() }).optional(),
  attachments: z.array(z.object({ name: z.string().max(255), mime: z.string().max(255) })).max(20).default([]),
  score: z.number().int().min(0).max(100),
  flag: z.enum(["green", "yellow", "orange", "red", "darkred", "grey"]),
  reasonCodes: z.array(z.string().max(64)).max(20).default([]),
  version: z.string().max(32),
  indicatorsOnly: z.boolean().optional(),
  /** Defaults to email; the phishing scanner also reports SMS (smishing). */
  channel: z.enum(["email", "sms"]).optional(),
});
export type SignalReport = z.infer<typeof signalReportSchema>;

export const extensionReportSchema = z.object({ signals: signalReportSchema, consent: z.literal(true) });
