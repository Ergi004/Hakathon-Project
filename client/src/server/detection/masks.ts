/**
 * Masking before any message text is stored (SPEC 15.2). The same rules are
 * used by the extension (SPEC 12.1 mask.ts). Order matters: emails and IBANs
 * contain digit runs that would otherwise be caught by the phone rule.
 */

export const MASK_TOKENS = {
  email: "[EMAIL]",
  iban: "[IBAN]",
  card: "[CARD]",
  phone: "[PHONE]",
  id: "[ID]",
  name: "[NAME]",
} as const;

export type MaskKind = keyof typeof MASK_TOKENS;

export const PII_PATTERNS: Record<Exclude<MaskKind, "name">, RegExp> = {
  email: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi,
  iban: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
  card: /\b\d{4}(?:[ -]?\d{4}){2}(?:[ -]?\d{1,7})\b/g,
  phone: /(?:\+|\b00)355[\s.-]?\d(?:[\s.-]?\d){7,8}\b|\b0[2-9]\d?(?:[\s.-]?\d){6,8}\b/g,
  // Albanian personal number (NID): letter, 8 digits, letter. Also plain 10-digit IDs.
  id: /\b[A-T]\d{8}[A-W]\b|\b\d{10}\b/gi,
};

const SALUTATIONS =
  "(?:I nderuar|E nderuar|Të nderuar|Te nderuar|Përshëndetje|Pershendetje|Tungjatjeta|Zoti|Zonja|Z\\.|Znj\\.|I dashur|E dashur|Dear|Hello|Hi|Mr\\.?|Mrs\\.?|Ms\\.?)";
const NAME_RE = new RegExp(
  `(${SALUTATIONS}[ ,]+)(\\p{Lu}[\\p{Ll}'-]+(?:[ ]+\\p{Lu}[\\p{Ll}'-]+){0,2})`,
  "gu",
);

export interface MaskResult {
  text: string;
  counts: Record<MaskKind, number>;
}

/** Replace personal data with tokens. Pure and idempotent. */
export function mask(input: string): MaskResult {
  const counts: Record<MaskKind, number> = { email: 0, iban: 0, card: 0, phone: 0, id: 0, name: 0 };
  let text = input;
  for (const kind of ["email", "iban", "card", "phone", "id"] as const) {
    text = text.replace(PII_PATTERNS[kind], () => {
      counts[kind] += 1;
      return MASK_TOKENS[kind];
    });
  }
  text = text.replace(NAME_RE, (_m, salutation: string, name: string) => {
    if (name.startsWith("[")) return `${salutation}${name}`;
    counts.name += 1;
    return `${salutation}${MASK_TOKENS.name}`;
  });
  return { text, counts };
}

export function maskText(input: string): string {
  return mask(input).text;
}

/** True when text still contains a phone, IBAN, email or ID pattern (seed validation). */
export function containsPii(text: string): boolean {
  return (Object.values(PII_PATTERNS) as RegExp[]).some((re) => new RegExp(re.source, re.flags).test(text));
}
