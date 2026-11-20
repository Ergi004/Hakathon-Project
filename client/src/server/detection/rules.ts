import { foldText } from "./normalize";

/**
 * Cheap deterministic content signals (SPEC 6.1 rules.ts). Patterns run on
 * folded text (lower-case, no diacritics), so "gjobë" matches "gjobe".
 */
const PATTERNS = {
  urgency: [
    /\burgjent/, /\bmenjehere\b/, /\bsot\b/, /\bbrenda (?:\d+|nje|dy) (?:ore|oreve|dite|diteve)\b/, /\bafati?\b/,
    /\bskadon\b/, /\bnjoftim(?:i)? i fundit\b/, /\bpa vonese\b/, /\bshpejt\b/,
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
    /\bpermbarim/, /\bsekuestr/, /\bpenalitet/, /\bkamat/, /\bfine[ds]?\b/, /\bpenalt/, /\bsuspend/, /\bblocked\b/,
    /\blegal action\b/, /\bclosed\b/, /\barrest/, /\bcourt\b/, /\bdeactivat/,
  ],
  asks_secrets: [
    /\bkod(?:in|i)? (?:otp|sms|sigurie|verifikimi)\b/, /\botp\b/, /\bpin\b/, /\bfjalekalim/, /\bnumr(?:in|i) e kartes\b/,
    /\bte dhenat e kartes\b/, /\bcvv\b/, /\bkart(?:a|en|es) (?:e )?(?:identitetit|bankare|krediti|debiti)\b/,
    /\bnumr(?:in|i) personal\b/, /\bpasaport/, /\bcard (?:number|details)\b/, /\bone[- ]time (?:code|password)\b/,
    /\bpassword\b/, /\bid (?:number|card)\b/, /\bverify your (?:identity|account)\b/, /\blogin details\b/,
    /\bsecurity code\b/,
  ],
} as const;

export type RuleSignal = keyof typeof PATTERNS;

export function scoreRules(text: string): Record<RuleSignal, string | null> {
  const folded = foldText(text);
  const out = {} as Record<RuleSignal, string | null>;
  for (const key of Object.keys(PATTERNS) as RuleSignal[]) {
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
