/**
 * Masks personal data before anything leaves the browser (SPEC 12.1).
 * Same rules as the platform's src/server/detection/masks.ts; order matters:
 * emails and IBANs contain digit runs the phone rule would otherwise catch.
 */
export const MASK_TOKENS = { email: "[EMAIL]", iban: "[IBAN]", card: "[CARD]", phone: "[PHONE]", id: "[ID]", name: "[NAME]" } as const;
type Kind = keyof typeof MASK_TOKENS;

const PATTERNS: Record<Exclude<Kind, "name">, RegExp> = {
  email: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}\b/gi,
  iban: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g,
  card: /\b\d{4}(?:[ -]?\d{4}){2}(?:[ -]?\d{1,7})\b/g,
  phone: /(?:\+|\b00)355[\s.-]?\d(?:[\s.-]?\d){7,8}\b|\b0[2-9]\d?(?:[\s.-]?\d){6,8}\b/g,
  id: /\b[A-T]\d{8}[A-W]\b|\b\d{10}\b/gi,
};

const SALUTATIONS =
  "(?:I nderuar|E nderuar|Të nderuar|Te nderuar|Përshëndetje|Pershendetje|Tungjatjeta|Zoti|Zonja|Z\\.|Znj\\.|I dashur|E dashur|Dear|Hello|Hi|Mr\\.?|Mrs\\.?|Ms\\.?)";
const NAME_RE = new RegExp(`(${SALUTATIONS}[ ,]+)(\\p{Lu}[\\p{Ll}'-]+(?:[ ]+\\p{Lu}[\\p{Ll}'-]+){0,2})`, "gu");

export function mask(input: string): string {
  let text = input;
  for (const kind of ["email", "iban", "card", "phone", "id"] as const) text = text.replace(PATTERNS[kind], MASK_TOKENS[kind]);
  return text.replace(NAME_RE, (_m, salutation: string, name: string) => (name.startsWith("[") ? `${salutation}${name}` : `${salutation}${MASK_TOKENS.name}`));
}

/** Masks text but leaves URLs intact (they are the main signal and are not personal data). */
export function maskKeepingUrls(input: string): string {
  const urls: string[] = [];
  const held = input.replace(/\bhttps?:\/\/[^\s<>"')]+/gi, (u) => `\u0000${urls.push(u) - 1}\u0000`);
  return mask(held).replace(/\u0000(\d+)\u0000/g, (_m, i: string) => urls[Number(i)]);
}

/** hxxps://bad[.]example/path: how URLs are shown and sent in signal reports. */
export function defang(url: string): string {
  const m = url.match(/^([a-z][a-z0-9+.-]*:\/\/)?([^/?#\s]+)(.*)$/i);
  if (!m) return url.replace(/\./g, "[.]");
  return `${(m[1] ?? "").replace(/^http/i, "hxxp")}${m[2].replace(/\./g, "[.]")}${m[3]}`;
}

/** Strips query and fragment (they often carry the recipient's identity). */
export function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}
