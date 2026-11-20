import type { Reason, ReasonGroup } from "./types";

type Template = { group: ReasonGroup; sq: string; en: string };

/**
 * Bilingual, plain-language reason texts (SPEC 6.3: never blame the user,
 * say what was found). {e} is replaced by the defanged evidence when present.
 */
export const REASONS = {
  // links
  lookalike_typosquat: { group: "links", sq: "Domeni {e} është shkruar pothuajse njësoj si një domen zyrtar, por nuk është ai.", en: "The domain {e} is spelled almost like an official domain, but it is not the same." },
  lookalike_homoglyph: { group: "links", sq: "Domeni {e} përdor shkronja të ngjashme (p.sh. 1 në vend të l) për të imituar një domen zyrtar.", en: "The domain {e} uses lookalike characters (for example 1 instead of l) to imitate an official domain." },
  lookalike_combosquat: { group: "links", sq: "Domeni {e} përdor emrin e një institucioni me fjalë të shtuara, por nuk i përket atij.", en: "The domain {e} uses an institution's name with extra words, but it does not belong to it." },
  subdomain_trick: { group: "links", sq: "Adresa {e} fillon me emrin e një domeni zyrtar, por në fakt të çon diku tjetër.", en: "The address {e} starts with an official domain name but actually leads somewhere else." },
  punycode: { group: "links", sq: "Domeni {e} përmban shkronja nga alfabete të tjera që duken si latine.", en: "The domain {e} contains letters from other alphabets that look Latin." },
  domain_new: { group: "links", sq: "Domeni {e} është regjistruar shumë së fundmi (më pak se 30 ditë).", en: "The domain {e} was registered very recently (less than 30 days ago)." },
  odd_tld: { group: "links", sq: "Domeni {e} përdor një prapashtesë që përdoret shpesh nga mashtruesit.", en: "The domain {e} uses an ending that scammers often use." },
  shortener: { group: "links", sq: "Lidhja {e} është e shkurtuar dhe fsheh adresën e vërtetë.", en: "The link {e} is shortened and hides the real address." },
  link_mismatch: { group: "links", sq: "Teksti përmend një adresë zyrtare, por lidhja të çon te {e}.", en: "The text mentions an official address, but the link goes to {e}." },
  qr_unknown: { group: "links", sq: "Kodi QR të çon te {e}, që nuk është domen zyrtar.", en: "The QR code leads to {e}, which is not an official domain." },
  cert_fast: { group: "links", sq: "Certifikata e sigurisë për {e} u lëshua menjëherë pas regjistrimit.", en: "The security certificate for {e} was issued right after registration." },
  cert_brand: { group: "links", sq: "Certifikata e {e} përmban emrin e një institucioni.", en: "The certificate for {e} contains an institution's name." },
  whois_privacy: { group: "links", sq: "Pronari i domenit {e} është i fshehur.", en: "The owner of the domain {e} is hidden." },
  infra_pattern: { group: "links", sq: "Domeni {e} është në një regjistrues dhe hosting që shihen shpesh në fushata mashtrimi.", en: "The domain {e} uses a registrar and hosting often seen in scam campaigns." },
  // content
  classifier: { group: "content", sq: "Teksti i ngjan shumë mesazheve mashtruese të njohura.", en: "The text closely resembles known scam messages." },
  urgency: { group: "content", sq: "Mesazhi të nxit të veprosh menjëherë.", en: "The message pushes you to act immediately." },
  payment_lure: { group: "content", sq: "Mesazhi kërkon një pagesë ose premton një rimbursim.", en: "The message asks for a payment or promises a refund." },
  threat: { group: "content", sq: "Mesazhi kërcënon me gjobë, bllokim ose pasoja ligjore.", en: "The message threatens a fine, a block or legal consequences." },
  asks_secrets: { group: "content", sq: "Mesazhi kërkon të dhëna të kartës, kode OTP ose dokument identiteti. Institucionet nuk i kërkojnë kurrë kështu.", en: "The message asks for card details, OTP codes or an ID document. Institutions never ask for these this way." },
  // sender
  auth_fail: { group: "sender", sq: "Kontrolli i autenticitetit të emailit ({e}) dështoi.", en: "The email authenticity check ({e}) failed." },
  display_spoof: { group: "sender", sq: "Emri i dërguesit imiton {e}, por adresa nuk është zyrtare.", en: "The sender name imitates {e}, but the address is not official." },
  reply_to_mismatch: { group: "sender", sq: "Përgjigjet shkojnë te një adresë tjetër ({e}).", en: "Replies go to a different address ({e})." },
  freemail_institution: { group: "sender", sq: "Mesazhi pretendon se vjen nga {e}, por është dërguar nga një email falas.", en: "The message claims to be from {e} but was sent from a free email account." },
  unknown_sms_sender: { group: "sender", sq: "Dërguesi i SMS-së nuk është dërgues zyrtar i {e}.", en: "The SMS sender is not an official sender for {e}." },
  // attachments
  attachment_exec: { group: "attachments", sq: "Bashkëngjitja {e} mund të ekzekutojë program ose makro.", en: "The attachment {e} can run a program or macro." },
  attachment_archive: { group: "attachments", sq: "Bashkëngjitja {e} është arkiv që mund të fshehë skedarë të rrezikshëm.", en: "The attachment {e} is an archive that can hide dangerous files." },
  attachment_double_ext: { group: "attachments", sq: "Bashkëngjitja {e} ka prapashtesë të dyfishtë për t'u dukur e padëmshme.", en: "The attachment {e} has a double extension to look harmless." },
  // reputation
  known_bad: { group: "reputation", sq: "{e} është tashmë në listën tonë të mashtrimeve të njohura.", en: "{e} is already on our list of known scams." },
  confirmed_campaign: { group: "reputation", sq: "{e} është pjesë e një fushate mashtrimi të konfirmuar.", en: "{e} is part of a confirmed scam campaign." },
  many_reports: { group: "reputation", sq: "Disa persona e kanë raportuar {e} në 24 orët e fundit.", en: "Several people reported {e} in the last 24 hours." },
  // informational (weight 0)
  official_sender: { group: "sender", sq: "Dërguesi përputhet me një kanal zyrtar të {e}.", en: "The sender matches an official channel of {e}." },
  official_domain: { group: "links", sq: "{e} është domen zyrtar.", en: "{e} is an official domain." },
  not_analysed: { group: "content", sq: "Nuk kishte mjaftueshëm përmbajtje për ta analizuar.", en: "There was not enough content to analyse." },
} as const satisfies Record<string, Template>;

export type ReasonCode = keyof typeof REASONS;

export function reason(code: ReasonCode, weight: number, evidence?: string): Reason {
  const t: Template = REASONS[code];
  const fill = (s: string) => s.replace("{e}", evidence ?? "").replace(/\s+\(\)/, "").trim();
  return { code, group: t.group, weight, text_sq: fill(t.sq), text_en: fill(t.en), evidence };
}
