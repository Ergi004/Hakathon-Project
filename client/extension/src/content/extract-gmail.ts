import type { ExtractedEmail } from "../lib/types";
import { collectLinks, guessMime, visibleText } from "./dom";

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).offsetParent !== null;

/** The last expanded message of the open conversation (Gmail keeps collapsed ones without a body). */
function openMessage(): HTMLElement | null {
  const messages = [...document.querySelectorAll<HTMLElement>("div.adn")].filter((m) => visible(m.querySelector(".a3s")));
  return messages.at(-1) ?? null;
}

export function gmailEmailOpen(): boolean {
  return visible(document.querySelector("h2.hP")) && openMessage() !== null;
}

/** Reads only the opened message, only when the user clicked Scan. */
export function extractGmail(): ExtractedEmail | null {
  const msg = openMessage();
  if (!msg) return null;
  const body = msg.querySelector(".a3s");
  if (!body) return null;
  const senderEl = msg.querySelector("span.gD") ?? msg.querySelector("[email]");
  const attachments: ExtractedEmail["attachments"] = [];
  msg.querySelectorAll("[download_url]").forEach((a) => {
    // download_url = "mime/type:file name.ext:https://…"
    const [mime, name] = (a.getAttribute("download_url") ?? "").split(":");
    if (name) attachments.push({ name, mime: mime || guessMime(name) });
  });
  if (!attachments.length) {
    msg.querySelectorAll(".aV3, .aQA span").forEach((n) => {
      const name = n.textContent?.trim();
      if (name && !attachments.some((x) => x.name === name)) attachments.push({ name, mime: guessMime(name) });
    });
  }
  return {
    client: "gmail",
    subject: document.querySelector("h2.hP")?.textContent?.trim() || undefined,
    sender: senderEl?.getAttribute("email") ?? undefined,
    senderName: senderEl?.getAttribute("name") ?? senderEl?.textContent?.trim() ?? undefined,
    text: visibleText(body).slice(0, 20_000),
    links: collectLinks(body),
    attachments: attachments.slice(0, 20),
  };
}
