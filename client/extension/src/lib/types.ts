export type Flag = "green" | "yellow" | "orange" | "red" | "darkred" | "grey";

/** What the content script reads from the one email the user opened (only on click). */
export interface ExtractedEmail {
  client: "gmail" | "outlook" | "page";
  subject?: string;
  sender?: string;
  senderName?: string;
  text: string;
  links: { href: string; text: string }[];
  attachments: { name: string; mime: string }[];
}

export interface ViewReason { code: string; text: string; weight: number; group?: string; evidence?: string }
export interface IntelRow { key: string; provider: string; tier: "A" | "B"; status: string; verdict: string; detail?: string }
export interface IntelDomain { host: string; status: string; domainAgeDays: number | null; finalScore: number | null; rows: IntelRow[]; subdomains: number; error?: string }

export type StepKey = "read" | "local" | "engine" | "intel" | "report";
export type StepState = "pending" | "active" | "done" | "skipped" | "error";
export type ReportState = "none" | "below" | "needs_consent" | "countdown" | "cancelled" | "sending" | "sent" | "undone" | "failed";

/** Everything the overlay and popup render. Sent from the background worker on every change. */
export interface ScanView {
  id: string;
  phase: "local" | "engine" | "intel" | "report" | "done" | "error";
  steps: Record<StepKey, StepState>;
  progress: number;
  startedAt: string;
  finishedAt?: string;
  preliminary: boolean;
  score: number;
  baseScore?: number;
  flag: Flag;
  reasons: ViewReason[];
  groups?: Record<string, number>;
  explanation?: string;
  found: { links: number; domains: string[]; attachments: number; senderDomain?: string };
  intel: { mock: boolean; deep: boolean; domains: IntelDomain[] };
  report: { state: ReportState; protocol?: string; reportId?: string; deleteUntil?: string; submitAt?: string; error?: string };
  threshold: number;
  error?: string;
  subject?: string;
  at: string;
}

export interface Settings {
  /** One-time consent: send emails at or above the threshold to the authorities automatically. */
  autoSubmit: boolean;
  threshold: 40 | 60 | 80;
  /** Consent for tier B: the link is submitted to VirusTotal URL analysis and Hybrid Analysis. */
  deepScan: boolean;
}

export interface SentReport { reportId: string; protocol: string; at: string; deleteUntil: string; score: number; flag: Flag; subject?: string; undone?: boolean }

/** Messages over the content-script ⇄ background port. */
export type ToBackground = { type: "scan"; email: ExtractedEmail } | { type: "report"; always: boolean } | { type: "cancel" } | { type: "undo" };
export type ToContent = { type: "view"; view: ScanView };
