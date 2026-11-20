import type { ExtractedEmail } from "../lib/types";

/**
 * Provider adapters (PDF §9). They read ONLY the message currently open in the
 * tab, and only when the user clicks Scan (injected via activeTab + scripting).
 * Webmail DOMs change, so each adapter uses several selectors and reports
 * warnings instead of failing silently.
 */

const MAX_HTML = 400_000;
const MAX_TEXT = 90_000;
const MAX_LINKS = 150;

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getClientRects().length > 0;
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Gmail / Outlook wrap links (google.com/url?q=, safelinks); recover the real destination. */
export function unwrapLink(href: string): string {
  try {
    const u = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") ?? u.searchParams.get("url") ?? href;
    if (u.hostname.endsWith("safelinks.protection.outlook.com")) return u.searchParams.get("url") ?? href;
    return href;
  } catch {
    return href;
  }
}

function linksIn(root: Element): ExtractedEmail["links"] {
  const out: ExtractedEmail["links"] = [];
  const seen = new Set<string>();
  for (const a of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const raw = a.getAttribute("href") ?? "";
    if (!/^https?:/i.test(raw)) continue;
    const href = unwrapLink(a.href);
    const key = `${href}|${text(a)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ href, text: text(a).slice(0, 200) });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

/** HTML with wrapped links rewritten to their real destination, so server-side link-text checks see the truth. */
function cleanHtml(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  for (const a of Array.from(clone.querySelectorAll<HTMLAnchorElement>("a[href]"))) a.setAttribute("href", unwrapLink(a.href));
  for (const s of Array.from(clone.querySelectorAll("script, style"))) s.remove();
  return clone.innerHTML.slice(0, MAX_HTML);
}

function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf", zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    docm: "application/vnd.ms-word.document.macroenabled.12", xls: "application/vnd.ms-excel", xlsm: "application/vnd.ms-excel.sheet.macroenabled.12",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", html: "text/html", htm: "text/html", svg: "image/svg+xml",
    exe: "application/x-msdownload", js: "text/javascript", iso: "application/x-iso9660-image", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  };
  return map[ext] ?? "application/octet-stream";
}

const FILE_NAME = /[^\\/:*?"<>|\s][^\\/:*?"<>|]*\.[a-z0-9]{2,5}$/i;

export function gmail(): ExtractedEmail | null {
  if (location.hostname !== "mail.google.com") return null;
  const warnings: string[] = [];
  const bodies = Array.from(document.querySelectorAll("div.a3s")).filter(visible);
  const body = bodies.at(-1);
  if (!body) return null;
  const msg = body.closest("div.adn") ?? body.closest("[role='listitem']") ?? document.body;
  const fromEl = msg.querySelector("span.gD[email]") ?? document.querySelector("span.gD[email]");
  const sender = fromEl ? `${fromEl.getAttribute("name") ?? text(fromEl)} <${fromEl.getAttribute("email")}>` : undefined;
  if (!sender) warnings.push("sender_not_found");

  const attachments: ExtractedEmail["attachments"] = [];
  for (const el of Array.from(msg.querySelectorAll("[download_url]"))) {
    // download_url="mime/type:file name.pdf:https://…"
    const [mime, name] = (el.getAttribute("download_url") ?? "").split(":");
    if (name) attachments.push({ name, mime: mime || guessMime(name), size: 0 });
  }
  if (!attachments.length) {
    for (const el of Array.from(msg.querySelectorAll("span.aV3, div.aQA span"))) {
      const name = text(el);
      if (FILE_NAME.test(name)) attachments.push({ name, mime: guessMime(name), size: 0 });
    }
  }
  warnings.push("headers_not_in_dom");
  return {
    provider: "gmail",
    subject: text(document.querySelector("h2.hP")) || undefined,
    sender,
    body: ((body as HTMLElement).innerText ?? "").slice(0, MAX_TEXT),
    html: cleanHtml(body),
    links: linksIn(body),
    attachments: dedupe(attachments),
    warnings,
  };
}

export function outlook(): ExtractedEmail | null {
  if (!OUTLOOK_HOST.test(location.hostname)) return null;
  const warnings: string[] = [];
  const body =
    Array.from(document.querySelectorAll("div[aria-label='Message body'], div[aria-label='Trupi i mesazhit'], div[role='document']")).filter(visible).at(-1) ?? null;
  if (!body) return null;
  const pane = body.closest("[role='main']") ?? body.closest("#ReadingPaneContainerId") ?? document.body;
  const subject =
    text(pane.querySelector("[role='heading'][aria-level='2']")) ||
    text(document.querySelector("#ReadingPaneContainerId [role='heading']")) ||
    undefined;
  // Sender: Outlook renders "Name <address>" or an element whose title is the address.
  let sender: string | undefined;
  const titled = Array.from(pane.querySelectorAll("[title*='@']")).find((e) => /@/.test(e.getAttribute("title") ?? ""));
  if (titled) {
    const addr = (titled.getAttribute("title") ?? "").match(/[^\s<>]+@[^\s<>]+/)?.[0];
    sender = addr ? `${text(titled).replace(/<.*>/, "").trim() || addr} <${addr}>` : undefined;
  }
  if (!sender) {
    const m = (pane as HTMLElement).innerText?.slice(0, 2000).match(/([^\n<]{0,60})<([^\s<>]+@[^\s<>]+)>/);
    if (m) sender = `${m[1].trim()} <${m[2]}>`;
  }
  if (!sender) warnings.push("sender_not_found");

  const attachments: ExtractedEmail["attachments"] = [];
  for (const el of Array.from(pane.querySelectorAll("[role='listbox'] [role='option'], [data-testid*='ttachment'] [title]"))) {
    const name = (el.getAttribute("title") ?? text(el)).split("\n")[0].trim();
    if (FILE_NAME.test(name)) attachments.push({ name, mime: guessMime(name), size: 0 });
  }
  warnings.push("headers_not_in_dom");
  return {
    provider: "outlook",
    subject,
    sender,
    body: ((body as HTMLElement).innerText ?? "").slice(0, MAX_TEXT),
    html: cleanHtml(body),
    links: linksIn(body),
    attachments: dedupe(attachments),
    warnings,
  };
}

/**
 * Any other webmail: the user's selection, otherwise the main content area.
 * Never uses the tab title (webmail titles carry the signed-in user's address),
 * and only guesses a sender inside text the user selected.
 */
export function generic(selectionOnly = false): ExtractedEmail | null {
  const sel = window.getSelection();
  let root: Element | null = null;
  let body = "";
  const selected = !!sel && sel.toString().trim().length > 20 && sel.rangeCount > 0;
  if (selected) {
    body = sel.toString();
    const c = sel.getRangeAt(0).commonAncestorContainer;
    root = c.nodeType === 1 ? (c as Element) : c.parentElement;
  } else if (!selectionOnly) {
    root = document.querySelector("[role='main'], main, article") ?? document.body;
    body = (root as HTMLElement).innerText ?? "";
  }
  if (!body.trim() || !root) return null;
  const sender = selected ? body.slice(0, 1500).match(/[^\s<>()"']+@[^\s<>()"']+\.[a-z]{2,}/i)?.[0] : undefined;
  return {
    provider: "webmail",
    sender,
    body: body.slice(0, MAX_TEXT),
    links: linksIn(root),
    attachments: [],
    warnings: ["generic_adapter", "headers_not_in_dom", ...(selected ? ["selection"] : [])],
  };
}

function dedupe(list: ExtractedEmail["attachments"]) {
  const seen = new Set<string>();
  return list.filter((a) => (seen.has(a.name) ? false : (seen.add(a.name), true))).slice(0, 50);
}

const OUTLOOK_HOST = /^outlook\.(live|office|office365)\.com$/;

/**
 * Gmail / Outlook: only an opened message (or text the user selected). On the
 * inbox list there is no message, so we ask the user to open one instead of
 * reading the whole list.
 */
export function extractOpenEmail(): ExtractedEmail | { error: "open_message" | "no_message" } {
  if (location.hostname === "mail.google.com") return gmail() ?? generic(true) ?? { error: "open_message" };
  if (OUTLOOK_HOST.test(location.hostname)) return outlook() ?? generic(true) ?? { error: "open_message" };
  return generic() ?? { error: "no_message" };
}
