import type { ExtractedEmail, Flag, ViewReason } from "./types";

/**
 * Fast on-device rules so the overlay shows something within 100 ms (SPEC 12.1).
 * Preliminary only: the platform's engine gives the real verdict.
 */
const URGENCY = [
  "urgent", "immediately", "within 24 hours", "account suspended", "verify your account", "last warning", "final notice", "click here", "unpaid", "fine",
  "urgjent", "menjëherë", "menjehere", "brenda 24 orëve", "brenda 24 oreve", "llogaria juaj", "pezulluar", "verifikoni", "gjobë", "gjobe", "paralajmërim", "paralajmerim", "kliko këtu", "kliko ketu", "pagesë e prapambetur",
];
const MONEY = ["iban", "card number", "numri i kartës", "numri i kartes", "pin", "password", "fjalëkalim", "fjalekalim", "kodi otp", "otp"];

const LEVELS: [number, Flag][] = [[80, "darkred"], [60, "red"], [40, "orange"], [20, "yellow"]];
export const flagFor = (score: number): Flag => LEVELS.find(([min]) => score >= min)?.[1] ?? "green";

export function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Link text that names a different domain than where the link goes. */
export function mismatchedLinks(links: ExtractedEmail["links"]): { shown: string; actual: string }[] {
  const out: { shown: string; actual: string }[] = [];
  for (const l of links) {
    const shownMatch = l.text.trim().match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
    const actual = hostOf(l.href);
    if (!shownMatch || !actual) continue;
    const shown = shownMatch[1].toLowerCase();
    if (actual !== shown && !actual.endsWith(`.${shown}`)) out.push({ shown, actual });
  }
  return out;
}

export function analyzeLocal(email: ExtractedEmail, t: (key: string, sub?: string) => string): { score: number; flag: Flag; reasons: ViewReason[] } {
  const text = `${email.subject ?? ""}\n${email.text}`.toLowerCase();
  const reasons: ViewReason[] = [];
  const urg = URGENCY.filter((w) => text.includes(w));
  if (urg.length) reasons.push({ code: "urgency", weight: Math.min(15, urg.length * 5), text: t("localUrgency") });
  if (MONEY.some((w) => new RegExp(`\\b${w}\\b`, "i").test(text))) reasons.push({ code: "credentials", weight: 10, text: t("localCredentials") });
  const mm = mismatchedLinks(email.links);
  if (mm.length) reasons.push({ code: "link_mismatch", weight: 20, text: t("localMismatch", mm[0].actual.replace(/\./g, "[.]")) });
  if (email.links.some((l) => /^https?:\/\/\d{1,3}(\.\d{1,3}){3}/.test(l.href))) reasons.push({ code: "ip_link", weight: 15, text: t("localIpLink") });
  if (email.attachments.some((a) => /\.(exe|scr|js|vbs|bat|cmd|iso|docm|xlsm)$/i.test(a.name))) reasons.push({ code: "risky_attachment", weight: 15, text: t("localAttachment") });
  const score = Math.min(100, reasons.reduce((s, r) => s + r.weight, 0));
  return { score, flag: flagFor(score), reasons: reasons.sort((a, b) => b.weight - a.weight).slice(0, 3) };
}
