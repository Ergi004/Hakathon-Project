/** Tiny DOM builder (no innerHTML: Gmail enforces Trusted Types). */
type Child = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | ((e: Event) => void)> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") el.addEventListener(k.replace(/^on/, "").toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(typeof c === "string" ? document.createTextNode(c) : c);
  return el;
}

export function svg(tag: string, attrs: Record<string, string>, ...children: SVGElement[]): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

/** Visible text of an element without scripts/styles, whitespace collapsed per line. */
export function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("script,style,noscript").forEach((n) => n.remove());
  const raw = (el as HTMLElement).innerText ?? clone.textContent ?? "";
  return raw.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

export function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf", zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed", exe: "application/x-msdownload",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docm: "application/vnd.ms-word.document.macroEnabled.12",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
    html: "text/html", htm: "text/html", js: "text/javascript", iso: "application/x-iso9660-image", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Gmail and Outlook wrap links in redirectors; recover the real target. */
export function unwrapRedirect(href: string): string {
  try {
    const u = new URL(href);
    if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname === "/url") return u.searchParams.get("q") ?? u.searchParams.get("url") ?? href;
    if (/safelinks\.protection\.outlook\.com$/.test(u.hostname)) return u.searchParams.get("url") ?? href;
    return href;
  } catch {
    return href;
  }
}

export function collectLinks(root: Element): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  root.querySelectorAll("a[href]").forEach((a) => {
    const anchor = a as HTMLAnchorElement;
    const href = unwrapRedirect(anchor.href);
    if (!/^https?:\/\//i.test(href)) return;
    out.push({ href, text: (anchor.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200) });
  });
  return out.slice(0, 50);
}
