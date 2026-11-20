import { foldText } from "./normalize";

/**
 * Cheap deterministic content signals (SPEC 6.1 rules.ts). Patterns run on
 * folded text (lower-case, no diacritics), so "gjobë" matches "gjobe".
 */
const PATTERNS = {
  urgency: [
    /\burgjent/, /\bmenjehere\b/, /\bsot\b/, /\bbrenda (?:\d+|nje|dy) (?:ore|oreve|dite|diteve)\b/, /\bafati?\b/,
    /\bskadon\b/, /\bnjoftim(?:i)? i fundit\b/, /\bpa vonese\b/, /\bshpejt\b/, /\bneser\b/,
    /\burgent/, /\bimmediately\b/, /\btoday\b/, /\bwithin \d+ (?:hours?|days?)\b/, /\bexpires?\b/, /\bfinal notice\b/,
    /\blast chance\b/, /\bact now\b/, /\bas soon as possible\b/,
  ],
  payment_lure: [
    /\bpagu(?:a|aj|ani|ni|het|ar)\b/, /\bpages(?:e|a|en)\b/, /\brimburs/, /\bkthim(?:i)? (?:i )?parave\b/, /\btarif/,
    /\bdetyrim/, /\bfatur/, /\bshpenzime (?:dergese|transporti)\b/, /\bdogan/, /\bfitu(?:at|esi|ar)\b/, /\bshperblim/,
    /\bpay(?:ment)?\b/, /\brefund/, /\bfee\b/, /\binvoice\b/, /\boutstanding\b/, /\bbalance due\b/, /\bcustoms\b/,
    /\bprize\b/, /\bwon\b/, /\bcompensation\b/,
  ],
  threat: [
    /\bgjob/, /\bbllok(?:im|uar|ohet|ohen|ohet)/, /\bpezull/, /\bmbyll(?:je|et|ur)/, /\bprocedur(?:e|a) ligjore\b/,
    /\bpermbarim/, /\bsekuestr/, /\bpenalitet/, /\bfine[ds]?\b/, /\bpenalt/, /\bsuspend/, /\bblocked\b/,
    /\blegal action\b/, /\bclosed\b/, /\barrest/, /\bcourt\b/, /\bdeactivat/,
  ],
  asks_secrets: [
    /\bnumr(?:in|i) personal\b/, /\bpasaport/, /\bkart(?:a|en|es) (?:e )?identitetit\b/,
    /\bid (?:number|card)\b/, /\bverify your (?:identity|account)\b/, /\blogin details\b/,
    /\bhyr(?:ni|je)? ne llogari/, /\bverifiko(?:ni)? (?:llogarine|te dhenat|identitetin)\b/,
  ],
} as const;

const DELIVERED_CODE =
  /\b(?:kodi(?: juaj)?|your code|your otp|your pin|otp|pin|code)\s+(?:juaj\s+)?(?:eshte|is|:)?\s*\d{4,8}\b/;
const SECRET_REQUEST =
  /\b(?:dergo|dergoni|jep|jepni|shkruaj|shkruani|vendos|send|share|reply|enter|give)\b/;
const CREDENTIAL = [
  /\bpin\b/, /\botp\b/, /\bfjalekalim/, /\bpassword\b/, /\bcvv\b/, /\bnumr(?:in|i) e kartes\b/,
  /\bte dhenat e kartes\b/, /\bkart(?:a|en|es) (?:e )?(?:bankare|krediti|debiti)\b/,
  /\bcard (?:number|details)\b/, /\bone[- ]time (?:code|password)\b/, /\bsecurity code\b/,
  /\bkod(?:in|i)? (?:otp|sms|sigurie|verifikimi)\b/, /\bkod(?:in|i) e verifikimit\b/,
  /\b(?:dergo|dergoni|jep|jepni|send|share)\b.{0,40}\b(?:kod|code|pin|otp|password)\b/,
  /\b(?:kod|code|pin|otp|password)\b.{0,40}\b(?:dergo|dergoni|jep|jepni|send|share)\b/,
];
const HARD_CREDENTIAL = [
  /\bfjalekalim/, /\bpassword\b/, /\bcvv\b/, /\bnumr(?:in|i) e kartes\b/, /\bte dhenat e kartes\b/,
  /\bkart(?:a|en|es) (?:e )?(?:bankare|krediti|debiti)\b/, /\bcard (?:number|details)\b/,
];

export type SecretTier = "credential" | "account";

/** A code the message hands over is not a request. Asking the person to send a PIN, password, or card is. */
export function matchSecrets(text: string): { tier: SecretTier; evidence: string } | null {
  const folded = foldText(text);
  const handedOver = DELIVERED_CODE.test(folded) && !SECRET_REQUEST.test(folded);
  const patterns = handedOver ? HARD_CREDENTIAL : CREDENTIAL;
  for (const re of patterns) {
    const hit = folded.match(re);
    if (hit) return { tier: "credential", evidence: hit[0] };
  }
  for (const re of PATTERNS.asks_secrets) {
    const hit = folded.match(re);
    if (hit) return { tier: "account", evidence: hit[0] };
  }
  return null;
}

const LATE_INTEREST = /\bkamat/;
const CALL_REQUEST = /\b(?:na\s+)?telefono(?:ni|je)?\b|\bcall (?:us|this|me|now)\b|\bring (?:us|this|me)\b|\bna merrni\b/;

/** Late interest counts only beside a deadline or a payment demand. */
export function lateInterest(text: string, rules: { urgency: string | null; payment_lure: string | null }): string | null {
  if (!rules.urgency && !rules.payment_lure) return null;
  return foldText(text).match(LATE_INTEREST)?.[0] ?? null;
}

/** The message tells the person to call, before any number is checked against the official list. */
export function asksToCall(text: string): boolean {
  return CALL_REQUEST.test(foldText(text));
}

export type RuleSignal = keyof typeof PATTERNS;

export function scoreRules(text: string): Record<RuleSignal, string | null> {
  const folded = foldText(text);
  const out = {} as Record<RuleSignal, string | null>;
  for (const key of Object.keys(PATTERNS) as RuleSignal[]) {
    if (key === "asks_secrets") {
      out[key] = matchSecrets(text)?.evidence ?? null;
      continue;
    }
    let hit: string | null = null;
    for (const re of PATTERNS[key]) {
      const m = folded.match(re);
      if (m) {
        hit = m[0];
        break;
      }
    }
    out[key] = hit;
  }
  return out;
}
