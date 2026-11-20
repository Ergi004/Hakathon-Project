import { foldText } from "@/server/detection/normalize";
import type { ExtractedIoc, ParsedMessage } from "./types";

/**
 * Does a scan concern Albania? Used by the SOC "Albania only" filter.
 * Each signal is concrete and stored with the scan so analysts see why:
 *  - al_sender:      SMS or email sender with an Albanian number (+355)
 *  - al_phone:       an Albanian phone number in the message
 *  - al_domain:      a link, sender or reply-to on a .al domain (incl. synthetic .al.example / .al.test)
 *  - al_institution: the engine matched an Albanian institution being imitated
 *  - albanian_text:  the text is written in Albanian
 */
export type AlbaniaSignal = "al_sender" | "al_phone" | "al_domain" | "al_institution" | "albanian_text";

const AL_DOMAIN = /(^|\.)[a-z0-9-]+\.al(\.(example|test))?$/i;
const STOPWORDS = new Set(["dhe", "te", "nje", "per", "juaj", "eshte", "nga", "ne", "me", "ju", "ose", "qe", "jane", "keni", "tuaj", "sot", "ketu", "kliko", "llogaria", "paketa", "pagesa", "brenda"]);

/** Albanian if it has ë/ç or enough Albanian function words. */
export function looksAlbanian(text: string): boolean {
  if (!text.trim()) return false;
  const diacritics = (text.match(/[ëçËÇ]/g) ?? []).length;
  const words = foldText(text).split(/[^a-z]+/).filter(Boolean);
  const hits = words.filter((w) => STOPWORDS.has(w)).length;
  return diacritics >= 2 || hits >= 3 || (diacritics >= 1 && hits >= 2);
}

export function albaniaSignals(msg: ParsedMessage, iocs: ExtractedIoc[], matchedInstitution?: boolean): AlbaniaSignal[] {
  const out = new Set<AlbaniaSignal>();
  for (const i of iocs) {
    if (i.type === "phone_number" && i.normalized.startsWith("+355")) out.add(i.locations.includes("sender") ? "al_sender" : "al_phone");
    if (i.type === "domain" && AL_DOMAIN.test(i.normalized)) out.add("al_domain");
    if (i.type === "email" && AL_DOMAIN.test(i.normalized.split("@")[1] ?? "")) out.add("al_domain");
  }
  if (msg.sender && /^\s*(\+|00)?355/.test(msg.sender.replace(/[\s().-]/g, ""))) out.add("al_sender");
  if (matchedInstitution) out.add("al_institution");
  if (looksAlbanian([msg.subject, msg.text].filter(Boolean).join("\n"))) out.add("albanian_text");
  return [...out];
}
