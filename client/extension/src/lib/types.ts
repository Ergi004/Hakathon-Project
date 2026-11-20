/** Shared contracts between the content adapters, the background worker and the popup. */

export type Provider = "gmail" | "outlook" | "webmail";

export interface ExtractedEmail {
  provider: Provider;
  subject?: string;
  sender?: string;
  replyTo?: string;
  body: string;
  html?: string;
  links: { href: string; text: string }[];
  attachments: { name: string; mime: string; size: number }[];
  warnings: string[];
}

export type ScanPayload =
  | { kind: "email"; email: ExtractedEmail }
  | { kind: "eml"; raw: string; fileName: string }
  | { kind: "sms"; text: string; sender?: string }
  | { kind: "selection"; text: string; as: "email" | "sms" };

export type Flag = "green" | "yellow" | "orange" | "red" | "darkred" | "grey";

export interface ScanSummary {
  scanId: string;
  title: string;
  channel: "EMAIL" | "SMS";
  status: "queued" | "processing" | "completed" | "partial" | "failed" | "error";
  progress: number;
  stages?: Record<string, string>;
  verdict?: string;
  risk?: number | null;
  severity?: string | null;
  flag: Flag;
  vtMax?: number | null;
  vt?: { type: string; value: string; malicious: number; suspicious: number; found: boolean; label: string | null }[];
  reasons?: { sq: string; en: string; weight: number }[];
  types?: string[];
  family?: string | null;
  /** Where captured data would be sent (bot, webhook, form handler), redacted. */
  exfil?: { kind: string; value: string; otherScans: number }[];
  actions?: { sq: string; en: string }[];
  albania?: boolean;
  error?: string;
  createdAt: string;
  /** Masked signal report, ready to send (built from the platform's report). Kept locally only. */
  signal?: import("./signal").SignalReport;
  /** Set once a signal report was sent to the SOC inbox. */
  submitted?: { reportId: string; protocol: string; deleteUntil: string; indicatorsOnly: boolean; auto: boolean; deleted?: boolean };
  submitError?: string;
}

export interface Settings {
  server: string;
  lang: "sq" | "en";
  /** Auto-submit after a one-time consent (SPEC 12.2). Off by default. */
  autoSubmit: boolean;
  consentAt: string | null;
}

export type BgMessage =
  | { type: "scan"; payload: ScanPayload }
  | { type: "reset-token" }
  | { type: "report"; scanId: string }
  | { type: "undo-report"; scanId: string };
export type BgReply = { ok: true; scanId: string } | { ok: false; error: string };
