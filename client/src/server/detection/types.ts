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
  headers?: {
    spf?: AuthResult;
    dkim?: AuthResult;
    /** Whether the DKIM signature domain aligns with the From domain. Missing is not a fail. */
    dkimAligned?: boolean;
    dmarc?: AuthResult;
    dmarcPolicy?: "none" | "quarantine" | "reject";
    replyTo?: string;
  };
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

export type Verdict =
  | "not_analysed"
  | "no_strong_signals"
  | "safe"
  | "careful"
  | "suspicious"
  | "likely_scam"
  | "high"
  | "confirmed_scam"
  | "known_malicious";

export type SignalState = "fired" | "not_fired" | "unavailable";

export interface SignalAssessment {
  code: string;
  state: SignalState;
}

/** A floor that matched after the group sum. `reason` is the analyst-facing explanation. */
export interface AppliedOverride {
  id: string;
  floor: number;
  reason: string;
}

export interface AnalysisResult {
  score: number;
  flag: FlagLevel;
  /** Band name. The lowest band is "no strong signals"; "safe" needs positive evidence. */
  verdict: Verdict;
  groups: Record<ReasonGroup, number>;
  reasons: Reason[];
  /** 1 when every evaluated input was present. Unavailable inputs lower it, down to the config floor. */
  confidence: number;
  /** Inputs that were missing, so their signals could not add risk. */
  unavailableSignals: string[];
  /** One state for every known signal. */
  signals: SignalAssessment[];
  /** Floors that matched after the group sum, highest floor first. */
  overridesApplied: AppliedOverride[];
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
