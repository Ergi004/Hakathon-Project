/** Contracts from SPEC 6.2. */
import type { FlagLevel } from "@/lib/flags";
import type { ScamClassification, ScamFeatures } from "./pattern";

export type { FlagLevel };

export type Channel = "sms" | "email" | "social" | "web" | "qr" | "call" | "other";
export type AuthResult = "pass" | "fail" | "none";

export interface AnalysisInput {
  kind: "url" | "text" | "phone" | "email_signals" | "qr";
  text?: string;
  urls?: string[];
  sender?: string;
  subject?: string;
  headers?: { spf?: AuthResult; dkim?: AuthResult; dmarc?: AuthResult; dmarcPolicy?: "none" | "quarantine" | "reject"; replyTo?: string };
  attachments?: { name: string; mime: string; size: number }[];
  channel: Channel;
  locale: "sq" | "en";
}

export type ReasonGroup = "links" | "content" | "sender" | "attachments" | "reputation";

export interface Reason {
  code: string;
  group: ReasonGroup;
  weight: number;
  text_sq: string;
  text_en: string;
  evidence?: string;
}

/** Signals stored on a check. `claimedPlace` is a municipality or institution named in the lure, never a victim location. */
export interface CheckFeatures extends ScamFeatures {
  claimedPlace: string | null;
}

export interface AnalysisResult {
  score: number;
  flag: FlagLevel;
  groups: Record<ReasonGroup, number>;
  reasons: Reason[];
  campaign?: {
    id?: string;
    code?: string;
    matchType: "known" | "similar" | "new_candidate";
    confidence: number;
  };
  matchedInstitution?: { id: string; name: string };
  iocs: { type: "domain" | "url" | "phone" | "email"; value: string }[];
  modelVersion: string;
  /** Weighted pattern classification. Message text is not included. */
  classification: ScamClassification;
  features: CheckFeatures;
}

/** Group caps from SPEC 6.3. */
export const GROUP_CAPS: Record<ReasonGroup, number> = {
  links: 30,
  content: 25,
  sender: 25,
  attachments: 10,
  reputation: 10,
};
