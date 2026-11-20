/** Shared contracts for the Phishing Intelligence Scanner (docs/PHISHING-INTEL.md). Pure: no server-only imports. */

import type { ExfilEndpoint } from "./intelligence/exfil-extractor";

export type { ExfilEndpoint };

export type ScanChannel = "email" | "sms" | "ott_message";
export type ScanSource = "gmail" | "outlook" | "webmail" | "eml" | "msg" | "manual_input" | "sms_export" | "messages_web" | "api";
export type ScanStatus = "queued" | "processing" | "completed" | "partial" | "failed";
export type Verdict = "malicious" | "suspicious" | "clean" | "unknown";
export type Severity = "low" | "medium" | "high" | "critical";
export type AttributionStatus = "confirmed" | "high_confidence" | "possible" | "unattributed";

export const STAGES = ["parsing", "iocExtraction", "heuristics", "virusTotal", "aiAnalysis", "attribution", "report"] as const;
export type Stage = (typeof STAGES)[number];
export type StageStatus = "pending" | "running" | "completed" | "partial" | "skipped" | "failed";
export type Stages = Record<Stage, StageStatus>;

export type IocType = "url" | "domain" | "ip" | "file_hash" | "email" | "phone_number" | "short_code" | "exfil_endpoint";
export type IocLocation = "body" | "html_href" | "header" | "sender" | "reply_to" | "return_path" | "attachment" | "subject";

export interface ExtractedIoc {
  type: IocType;
  /** Canonical form used for lookups and correlation (refanged, lower-case host, E.164 phone). */
  normalized: string;
  /** Defanged display form. */
  display: string;
  locations: IocLocation[];
  /** exfil_endpoint only: ExfilKind (telegram_bot, php_handler…). */
  subtype?: string;
  /** exfil_endpoint only: where it was found, method, chat id, secret hash. Never the secret itself. */
  detail?: Record<string, string>;
}

export interface AuthResults {
  spf: "pass" | "fail" | "softfail" | "neutral" | "none";
  dkim: "pass" | "fail" | "none";
  dmarc: "pass" | "fail" | "none";
  /** "authentication-results" when read from the receiving server's header, otherwise "client" or "absent". */
  source: "authentication-results" | "client" | "absent";
}

export interface AttachmentMeta {
  name: string;
  mime: string;
  size: number;
  sha256?: string;
  /** Detected from magic bytes when the file content was available. */
  detectedType?: string;
}

/**
 * Minimised, channel-neutral message after parsing. `text` lives only in memory;
 * what is stored is `maskedText` (SPEC hard rule 5).
 */
export interface ParsedMessage {
  channel: ScanChannel;
  source: ScanSource;
  subject?: string;
  sender?: string;
  replyTo?: string;
  returnPath?: string;
  text: string;
  hrefs: { href: string; display: string }[];
  attachments: AttachmentMeta[];
  auth: AuthResults;
  headerFindings: Finding[];
  /** Where captured data would be sent (forms, scripts, bots), from the body and attachments. */
  exfil: ExfilEndpoint[];
  receivedAt?: string;
  locale: "sq" | "en";
}

export interface Finding {
  code: string;
  /** Plain English for the report; the UI translates via code. */
  detail: string;
  evidence?: string;
  weight: number;
}

export interface Reputation {
  provider: "virustotal";
  type: IocType;
  value: string;
  found: boolean;
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  reputation: number | null;
  threatLabel: string | null;
  categories: string[];
  lastAnalysisAt: string | null;
  cached: boolean;
}

export interface Classification {
  dimension: "phishing_type" | "phishing_family" | "malware_family";
  value: string;
  confidence: number;
  evidence: string[];
  source: "rules" | "virustotal" | "ai";
}

export interface TechniqueHit {
  id: string;
  name: string;
  tactic: string;
  observation: string;
}

export interface AttributionResult {
  status: AttributionStatus;
  confidence: number;
  campaign: { id: string; code: string; status: string; matchedOn: string[] } | null;
  actor: { id: string; name: string } | null;
  evidence: { kind: string; source: string; sourceUrl: string | null; verified: boolean; observedAt: string }[];
  facts: string[];
  assessment: string;
  uncertainty: string;
}

export interface RiskComponents {
  virusTotal: number | null;
  authentication: number | null;
  urlDomain: number | null;
  heuristics: number | null;
  attachments: number | null;
  campaign: number | null;
}
