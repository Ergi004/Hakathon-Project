import type { ReasonCode } from "../reasons";

/**
 * Versioned risk-scoring config. The live fuse() path does not read this yet.
 * Every number the scorer will use lives here.
 */
export const SCORING_VERSION = "risk-1" as const;

const FAMILY_CAP = 100;
const STACK_REMAINDER = 0.25;

export const SCORING_FAMILIES = [
  "lookalike_domain",
  "domain_infra",
  "link_behavior",
  "impersonation",
  "sender_auth",
  "text_pressure",
  "page_content",
  "attachment",
  "reputation",
] as const;

export type ScoringFamily = (typeof SCORING_FAMILIES)[number];

const LOOKALIKE_CODES = ["typosquat", "homoglyph", "combo_word", "subdomain_trick"] as const;

export type SignalCondition =
  | { kind: "requires_any"; codes: readonly string[] }
  | { kind: "requires_link_or_institution" }
  | { kind: "rejects_delivered_code" }
  | { kind: "requires_form" }
  | { kind: "add_only" }
  | { kind: "distinct_reporters" };

/** Weight used instead of `weight` when the pipeline reports this variant. */
export interface SignalAlternate {
  id: string;
  weight: number;
}

type NewReasonKey =
  | "credential_form_non_official"
  | "exfil_chat_bot_or_webhook"
  | "exfil_php_or_third_party"
  | "brand_logo_or_layout_match_non_brand_domain"
  | "known_phishing_kit"
  | "cloaking"
  | "domain_age_over_2_years"
  | "aligned_dmarc_pass";

export type PlainReasonKey = ReasonCode | NewReasonKey;

export interface ScoringSignal {
  code: string;
  family: ScoringFamily;
  /** Points when the signal fires. Classifier and LLM review treat this as a ceiling. */
  weight: number;
  plainReasonKey: PlainReasonKey;
  actionable: boolean;
  condition?: SignalCondition;
  alternates?: readonly SignalAlternate[];
  /** Hard cap after per-occurrence weights, used by email auth failures. */
  cap?: number;
  /** Pipeline may send a partial weight up to `weight`. The signal cannot exceed it. */
  ceiling?: boolean;
}

export interface NegativeSignal {
  code: string;
  plainReasonKey: PlainReasonKey;
  /** Fraction of remaining risk removed. Combined reduction is capped. */
  reduction: number;
}

export interface FloorOverride {
  id: string;
  floor: number;
  allOf: readonly string[];
  anyOf?: readonly string[];
}

const signals = [
  { code: "typosquat", family: "lookalike_domain", weight: 20, plainReasonKey: "lookalike_typosquat", actionable: true },
  { code: "homoglyph", family: "lookalike_domain", weight: 25, plainReasonKey: "lookalike_homoglyph", actionable: true },
  { code: "combo_word", family: "lookalike_domain", weight: 18, plainReasonKey: "lookalike_combosquat", actionable: true },
  { code: "subdomain_trick", family: "lookalike_domain", weight: 20, plainReasonKey: "subdomain_trick", actionable: true },
  {
    code: "punycode",
    family: "lookalike_domain",
    weight: 8,
    plainReasonKey: "punycode",
    actionable: false,
    condition: { kind: "requires_any", codes: LOOKALIKE_CODES },
  },
  {
    code: "registered_under_30d",
    family: "domain_infra",
    weight: 10,
    plainReasonKey: "domain_new",
    actionable: false,
    alternates: [{ id: "under_7d", weight: 15 }],
  },
  { code: "unusual_tld", family: "domain_infra", weight: 5, plainReasonKey: "odd_tld", actionable: false },
  { code: "cert_right_after_registration", family: "domain_infra", weight: 3, plainReasonKey: "cert_fast", actionable: false },
  { code: "cert_contains_brand", family: "domain_infra", weight: 4, plainReasonKey: "cert_brand", actionable: false },
  { code: "hosting_pattern_seen_in_campaigns", family: "domain_infra", weight: 3, plainReasonKey: "infra_pattern", actionable: false },
  { code: "hidden_owner", family: "domain_infra", weight: 0, plainReasonKey: "whois_privacy", actionable: false },
  { code: "shortened_link", family: "link_behavior", weight: 6, plainReasonKey: "shortener", actionable: true },
  { code: "link_text_mismatch", family: "link_behavior", weight: 12, plainReasonKey: "link_mismatch", actionable: true },
  { code: "unknown_qr_destination", family: "link_behavior", weight: 10, plainReasonKey: "qr_unknown", actionable: true },
  { code: "institution_named_link_not_theirs", family: "impersonation", weight: 18, plainReasonKey: "impersonated_link", actionable: true },
  { code: "sms_claims_institution_not_official_sender", family: "impersonation", weight: 25, plainReasonKey: "unofficial_claim", actionable: true },
  { code: "display_name_spoof", family: "impersonation", weight: 10, plainReasonKey: "display_spoof", actionable: true },
  { code: "reply_to_mismatch", family: "impersonation", weight: 6, plainReasonKey: "reply_to_mismatch", actionable: true },
  { code: "freemail_claiming_institution", family: "impersonation", weight: 10, plainReasonKey: "freemail_institution", actionable: true },
  {
    code: "email_auth_failure",
    family: "sender_auth",
    weight: 10,
    cap: 20,
    plainReasonKey: "auth_fail",
    actionable: true,
  },
  {
    code: "unknown_sms_sender",
    family: "sender_auth",
    weight: 12,
    plainReasonKey: "unknown_sms_sender",
    actionable: true,
    condition: { kind: "requires_link_or_institution" },
  },
  { code: "urgency", family: "text_pressure", weight: 5, plainReasonKey: "urgency", actionable: true },
  { code: "payment_demand", family: "text_pressure", weight: 6, plainReasonKey: "payment_lure", actionable: true },
  { code: "threat", family: "text_pressure", weight: 5, plainReasonKey: "threat", actionable: true },
  {
    code: "asks_for_secrets",
    family: "text_pressure",
    weight: 15,
    plainReasonKey: "asks_secrets",
    actionable: true,
    condition: { kind: "rejects_delivered_code" },
  },
  { code: "text_classifier", family: "text_pressure", weight: 15, ceiling: true, plainReasonKey: "classifier", actionable: false },
  {
    code: "llm_review",
    family: "text_pressure",
    weight: 15,
    ceiling: true,
    plainReasonKey: "gemini_review",
    actionable: false,
    condition: { kind: "add_only" },
  },
  { code: "link_is_pay_or_signin_or_send_details", family: "page_content", weight: 20, plainReasonKey: "lure_destination", actionable: true },
  {
    code: "credential_form_non_official",
    family: "page_content",
    weight: 22,
    plainReasonKey: "credential_form_non_official",
    actionable: true,
    alternates: [{ id: "name_phone_or_email_only", weight: 12 }],
  },
  { code: "exfil_chat_bot_or_webhook", family: "page_content", weight: 25, plainReasonKey: "exfil_chat_bot_or_webhook", actionable: true },
  {
    code: "exfil_php_or_third_party",
    family: "page_content",
    weight: 10,
    plainReasonKey: "exfil_php_or_third_party",
    actionable: true,
    condition: { kind: "requires_form" },
  },
  {
    code: "brand_logo_or_layout_match_non_brand_domain",
    family: "page_content",
    weight: 22,
    plainReasonKey: "brand_logo_or_layout_match_non_brand_domain",
    actionable: true,
    alternates: [{ id: "logo_only", weight: 12 }],
  },
  { code: "known_phishing_kit", family: "page_content", weight: 25, plainReasonKey: "known_phishing_kit", actionable: true },
  {
    code: "cloaking",
    family: "page_content",
    weight: 10,
    plainReasonKey: "cloaking",
    actionable: true,
    alternates: [{ id: "hidden_login_form", weight: 15 }],
  },
  { code: "executable_or_macro", family: "attachment", weight: 15, plainReasonKey: "attachment_exec", actionable: true },
  { code: "password_protected_archive", family: "attachment", weight: 6, plainReasonKey: "attachment_archive", actionable: true },
  { code: "double_extension", family: "attachment", weight: 8, plainReasonKey: "attachment_double_ext", actionable: true },
  { code: "known_bad_indicator", family: "reputation", weight: 0, plainReasonKey: "known_bad", actionable: true },
  { code: "confirmed_campaign", family: "reputation", weight: 0, plainReasonKey: "confirmed_campaign", actionable: true },
  {
    code: "many_reports",
    family: "reputation",
    weight: 6,
    plainReasonKey: "many_reports",
    actionable: true,
    condition: { kind: "distinct_reporters" },
  },
] as const satisfies readonly ScoringSignal[];

const negatives = [
  { code: "official_allowlist_domain", plainReasonKey: "official_domain", reduction: 0.5 },
  { code: "domain_age_over_2_years", plainReasonKey: "domain_age_over_2_years", reduction: 0.15 },
  { code: "verified_official_sender", plainReasonKey: "official_sender", reduction: 0.4 },
  { code: "aligned_dmarc_pass", plainReasonKey: "aligned_dmarc_pass", reduction: 0.25 },
] as const satisfies readonly NegativeSignal[];

const BRAND_MATCH_CODES = [
  ...LOOKALIKE_CODES,
  "institution_named_link_not_theirs",
  "brand_logo_or_layout_match_non_brand_domain",
] as const;

const floors = [
  { id: "known_bad", floor: 90, allOf: ["known_bad_indicator"] },
  { id: "confirmed_campaign", floor: 85, allOf: ["confirmed_campaign"] },
  { id: "credential_form_exfil", floor: 90, allOf: ["credential_form_non_official", "exfil_chat_bot_or_webhook"] },
  { id: "phishing_kit", floor: 80, allOf: ["known_phishing_kit"] },
  { id: "brand_credential_form", floor: 80, allOf: ["credential_form_non_official"], anyOf: BRAND_MATCH_CODES },
] as const satisfies readonly FloorOverride[];

function familyRule(family: ScoringFamily): { cap: number; combine: "max" } | { cap: number; combine: "stack"; stackRemainder: number } {
  switch (family) {
    case "sender_auth":
    case "text_pressure":
    case "attachment":
      return { cap: FAMILY_CAP, combine: "stack", stackRemainder: STACK_REMAINDER };
    case "lookalike_domain":
    case "domain_infra":
    case "link_behavior":
    case "impersonation":
    case "page_content":
    case "reputation":
      return { cap: FAMILY_CAP, combine: "max" };
    default: {
      const unexpected: never = family;
      throw new Error(`Unexpected scoring family: ${String(unexpected)}`);
    }
  }
}

export const SCORING = {
  scoringVersion: SCORING_VERSION,
  familyCap: FAMILY_CAP,
  stackRemainder: STACK_REMAINDER,
  negativeReductionCap: 0.6,
  allowlistCap: { signal: "official_allowlist_domain" as const, cap: 10, yieldsToFloors: true },
  families: {
    lookalike_domain: familyRule("lookalike_domain"),
    domain_infra: familyRule("domain_infra"),
    link_behavior: familyRule("link_behavior"),
    impersonation: familyRule("impersonation"),
    sender_auth: familyRule("sender_auth"),
    text_pressure: familyRule("text_pressure"),
    page_content: familyRule("page_content"),
    attachment: familyRule("attachment"),
    reputation: familyRule("reputation"),
  },
  signals,
  negatives,
  floors,
  verdicts: {
    low: { min: 0, max: 29 },
    suspicious: { min: 30, max: 59 },
    high: { min: 60, max: 100 },
  },
  confidence: {
    start: 1,
    floor: 0.2,
    penalties: {
      page_not_loadable: 0.3,
      whois_failed: 0.15,
      reputation_lookup_failed: 0.1,
      text_only_no_url: 0.1,
    },
  },
} as const;

export type ScoringConfig = typeof SCORING;
export type ScoringSignalCode = (typeof signals)[number]["code"];
