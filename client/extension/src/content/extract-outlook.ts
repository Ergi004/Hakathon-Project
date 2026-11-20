import type { ExtractedEmail } from "../lib/types";
import { collectLinks, guessMime, visibleText } from "./dom";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/i;

function body(): HTMLElement | null {
  const docs = [...document.querySelectorAll<HTMLElement>('[role="main"] [role="document"], div[aria-label="Message body"], div[aria-label="Trupi i mesazhit"]')].filter((d) => d.offsetParent !== null);
  return docs.at(-1) ?? null;
}

export function outlookEmailOpen(): boolean {
  return body() !== null;
}

/** Best effort for Outlook on the web (class names are obfuscated; we rely on ARIA roles). */
export function extractOutlook(): ExtractedEmail | null {
  const b = body();
  if (!b) return null;
  const pane = b.closest('[role="main"]') ?? document;
  const subject = pane.querySelector('[role="heading"][aria-level="2"], [role="heading"]')?.textContent?.trim();
  let sender: string | undefined;
  for (const el of pane.querySelectorAll("[title], [aria-label]")) {
    const m = `${el.getAttribute("title") ?? ""} ${el.getAttribute("aria-label") ?? ""}`.match(EMAIL_RE);
    if (m) { sender = m[0].toLowerCase(); break; }
  }
  const attachments: ExtractedEmail["attachments"] = [];
  pane.querySelectorAll('[role="listbox"] [role="option"][title], [aria-label*="attachment" i][title]').forEach((n) => {
    const name = n.getAttribute("title")?.trim();
    if (name && /\.[a-z0-9]{2,5}$/i.test(name)) attachments.push({ name, mime: guessMime(name) });
  });
  return { client: "outlook", subject, sender, text: visibleText(b).slice(0, 20_000), links: collectLinks(b), attachments: attachments.slice(0, 20) };
}
