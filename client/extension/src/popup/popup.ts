import { FLAG_COLOR, getHistory, getSettings, originPattern, saveSettings } from "../lib/config";
import { STRINGS } from "../lib/i18n";
import type { BgReply, ExtractedEmail, Flag, ScanPayload, ScanSummary, Settings } from "../lib/types";

/**
 * Popup. Email/SMS/EML text from the page is untrusted: it is only ever set via
 * textContent, never innerHTML.
 */

let settings: Settings = { server: "http://localhost:3000", lang: "sq", autoSubmit: false, consentAt: null };
let t = STRINGS.sq;
let selectedId: string | null = null;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...children: (Node | string | null | undefined)[]) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

const SVG: Record<Flag, string> = {
  green: "M9 12l2 2 4-4M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  yellow: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  orange: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  red: "M15 9l-6 6m0-6l6 6M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z",
  darkred: "M15 9l-6 6m0-6l6 6M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z",
  grey: "M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3m.1 4h.01M12 22a10 10 0 100-20 10 10 0 000 20z",
};

/** Flag pill: colour + icon + word, never colour alone (SPEC hard rule 8). */
function flagPill(flag: Flag): HTMLElement {
  const pill = el("span", { className: "flag" });
  pill.style.background = FLAG_COLOR[flag];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", SVG[flag]);
  svg.append(path);
  pill.append(svg, t.flag[flag]);
  return pill;
}

function applyI18n() {
  document.documentElement.lang = settings.lang;
  $("app-title").textContent = t.appTitle;
  $("open-settings").setAttribute("aria-label", t.settings);
  for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"))) {
    const v = t[node.dataset.i18n as keyof typeof t];
    if (typeof v === "string") node.textContent = v;
  }
  $<HTMLInputElement>("sms-sender").placeholder = t.smsSenderPh;
  // SQ | EN switch: reflect the active language (roving tabindex for arrow-key navigation).
  $("lang-switch").setAttribute("aria-label", t.language);
  for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>("#lang-switch [data-lang]"))) {
    const on = b.dataset.lang === settings.lang;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  }
}

/** Switch the whole popup (and, via storage, the background menus/notifications) to another language. */
async function setLang(lang: "sq" | "en") {
  if (lang === settings.lang) return;
  await saveSettings({ lang });
  settings = { ...settings, lang };
  t = STRINGS[lang];
  applyI18n();
  renderConsent();
  await render();
}

function setupLangSwitch() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("#lang-switch [data-lang]"));
  for (const b of buttons) {
    b.addEventListener("click", () => void setLang(b.dataset.lang as "sq" | "en"));
    b.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const next = buttons[(buttons.indexOf(b) + 1) % buttons.length];
      next.focus();
      void setLang(next.dataset.lang as "sq" | "en");
    });
  }
}

function showError(code: string | null) {
  const box = $("error");
  if (!code) {
    box.hidden = true;
    return;
  }
  box.textContent = t.errors[code] ?? code;
  box.hidden = false;
}

function busy(id: string, on: boolean) {
  const b = $<HTMLButtonElement>(id);
  b.disabled = on;
  b.textContent = on ? t.scanning : (t[b.dataset.i18n as keyof typeof t] as string);
}

/** Host permission for the platform origin (Firefox MV3 asks the user; Chrome grants the manifest default). Must run inside the click. */
function ensurePermission(): Promise<boolean> {
  const origins = [originPattern(settings.server)];
  return chrome.permissions.contains({ origins }).then((has) => has || chrome.permissions.request({ origins }));
}

async function send(payload: ScanPayload, button: string, permission: Promise<boolean>) {
  showError(null);
  if (!(await permission)) return showError("permission_denied");
  busy(button, true);
  try {
    const reply = (await chrome.runtime.sendMessage({ type: "scan", payload })) as BgReply;
    if (!reply.ok) return showError(reply.error);
    selectedId = reply.scanId;
    await render();
  } finally {
    busy(button, false);
  }
}

async function scanOpenEmail(permission: Promise<boolean>) {
  showError(null);
  $("extract-info").textContent = "";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return showError("no_tab");
  let extracted: ExtractedEmail | { error: string } | undefined;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["extract.js"] });
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (globalThis as unknown as { __mburojaExtract: () => unknown }).__mburojaExtract(),
    });
    extracted = res?.result as typeof extracted;
  } catch {
    return showError("cannot_inject");
  }
  if (!extracted || "error" in extracted) return showError(extracted && "error" in extracted ? extracted.error : "no_message");
  const e = extracted;
  $("extract-info").textContent = `${t.extracted}: ${e.provider} · ${e.subject ?? "—"} · ${e.sender ?? "—"} · ${e.links.length} ${t.links} · ${e.attachments.length} ${t.attachments}`;
  await send({ kind: "email", email: e }, "scan-open", permission);
}

function renderResult(s: ScanSummary | undefined) {
  const box = $("result");
  box.replaceChildren();
  if (!s) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const done = s.status === "completed" || s.status === "partial";
  const lang = settings.lang;

  const head = el("div", { className: "res-head" }, flagPill(s.flag), el("span", { className: "score" }, done && s.risk !== null && s.risk !== undefined ? `${s.risk}/100` : ""));
  box.append(el("h2", {}, t.result), head, el("p", { className: "res-title", title: s.title }, `${s.channel} · ${s.title}`));

  if (s.status === "error" || s.status === "failed") {
    box.append(el("p", { className: "error" }, s.error ? (t.errors[s.error] ?? s.error) : t.failed));
  } else if (!done) {
    const bar = el("div", { className: "progress", role: "progressbar" });
    bar.setAttribute("aria-valuenow", String(s.progress));
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-label", t.scanning);
    const fill = el("span");
    fill.style.width = `${Math.max(5, s.progress)}%`;
    bar.append(fill);
    const running = Object.entries(s.stages ?? {}).find(([, v]) => v === "running" || v === "pending");
    box.append(bar, el("p", { className: "muted small" }, `${t.scanning} ${running ? t.stage[running[0]] ?? running[0] : ""}`));
  } else {
    const chips = el("div", { className: "chips" });
    if (s.verdict) chips.append(el("span", { className: "chip" }, t.verdict[s.verdict as keyof typeof t.verdict] ?? s.verdict));
    for (const ty of s.types ?? []) chips.append(el("span", { className: "chip" }, ty.replace(/_/g, " ")));
    if (s.family) chips.append(el("span", { className: "chip" }, s.family.replace(/_/g, " ")));
    box.append(chips);

    const vt = el("div", { className: "vt" }, el("h2", {}, t.vt));
    if (!s.vt?.length) vt.append(el("p", { className: "muted small" }, t.vtNone));
    else {
      vt.append(el("p", { className: s.vtMax ? "bad" : "muted small" }, s.vtMax ? t.vtEngines(s.vtMax) : t.vtClean));
      const table = el("table");
      for (const v of s.vt) {
        table.append(
          el(
            "tr",
            {},
            el("td", { className: "mono" }, v.value),
            el("td", { className: `n ${v.malicious ? "bad" : ""}` }, v.found ? `${v.malicious}` : t.vtNotFound),
            el("td", { className: "small" }, v.label ?? ""),
          ),
        );
      }
      vt.append(table);
    }
    box.append(vt);

    if (s.exfil?.length) {
      const ex = el("div", { className: "exfil", role: "note" }, el("h2", {}, t.exfilTitle));
      for (const e of s.exfil) {
        ex.append(el("p", { className: "small" }, el("strong", {}, t.exfilKind[e.kind] ?? e.kind), " · ", el("span", { className: "mono" }, e.value), e.otherScans ? ` · ${t.exfilOther(e.otherScans)}` : ""));
      }
      box.append(ex);
    }

    if (s.reasons?.length) box.append(el("h2", {}, t.reasons), el("ul", {}, ...s.reasons.map((r) => el("li", {}, r[lang]))));
    if (s.actions?.length) box.append(el("h2", {}, t.whatToDo), el("ul", {}, ...s.actions.map((a) => el("li", {}, a[lang]))));
  }

  const row = el("div", { className: "row" });
  if (done) box.append(...reportBlock(s), row);
  else box.append(row);

  // Manual report: available for any finished, rated scan not yet sent (or sent and undone).
  if (done && s.flag !== "grey" && s.signal && (!s.submitted || s.submitted.deleted)) {
    const report = el("button", { type: "button", className: "btn primary" }, t.reportToSoc);
    report.addEventListener("click", () => {
      report.disabled = true;
      void (chrome.runtime.sendMessage({ type: "report", scanId: s.scanId }) as Promise<BgReply>).then((r) => {
        if (!r.ok) showError(r.error);
        void render();
      });
    });
    row.append(report);
  }
  const open = el("button", { type: "button", className: "btn" }, t.openSoc);
  open.addEventListener("click", () => void chrome.tabs.create({ url: `${settings.server.replace(/\/$/, "")}/${lang}/soc/intel/${s.scanId}` }));
  row.append(open);
}

/** "Sent to SOC" notice with Undo while the 10-minute window is open (SPEC 12.2). */
function reportBlock(s: ScanSummary): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (s.submitError) out.push(el("p", { className: "error" }, t.errors[s.submitError] ?? s.submitError));
  const sub = s.submitted;
  if (!sub) return out;
  if (sub.deleted) return [...out, el("p", { className: "sent small" }, t.undone)];
  const text = (sub.indicatorsOnly ? t.reportSentIndicators(sub.protocol) : t.reportSent(sub.protocol)) + (sub.auto ? ` (${t.autoLabel})` : "");
  const block = el("div", { className: "sent", role: "status" }, el("p", { className: "small" }, text));
  const left = Math.ceil((Date.parse(sub.deleteUntil) - Date.now()) / 60_000);
  if (left > 0) {
    const undo = el("button", { type: "button", className: "btn" }, t.undo(left));
    undo.addEventListener("click", () => {
      undo.disabled = true;
      void (chrome.runtime.sendMessage({ type: "undo-report", scanId: s.scanId }) as Promise<BgReply>).then((r) => {
        if (!r.ok) showError(r.error);
        void render();
      });
    });
    block.append(undo);
  }
  out.push(block);
  return out;
}

function renderConsent() {
  const rules = $("consent-rules");
  rules.replaceChildren(...t.consentRules.map((r) => el("li", {}, r)));
  $<HTMLInputElement>("auto-submit").checked = settings.autoSubmit;
  $("consent-since").textContent = settings.autoSubmit && settings.consentAt ? t.consentSince(new Date(settings.consentAt).toLocaleString(settings.lang === "sq" ? "sq-AL" : "en-GB")) : "";
  const prompt = $("consent-prompt");
  prompt.textContent = t.consentPrompt;
  prompt.hidden = settings.consentAt !== null;
}

async function render() {
  const history = await getHistory();
  const current = (await chrome.storage.local.get("current")).current as string | undefined;
  const id = selectedId ?? current ?? history[0]?.scanId;
  renderResult(history.find((h) => h.scanId === id));

  const list = $("history-list");
  list.replaceChildren();
  if (!history.length) list.append(el("li", { className: "muted small" }, t.noHistory));
  for (const h of history.slice(0, 6)) {
    const dot = el("span", { className: "dot" });
    dot.style.background = FLAG_COLOR[h.flag];
    const b = el("button", { type: "button" }, dot, el("span", { className: "h-title" }, `${h.channel} · ${h.title}`), el("span", { className: "small muted" }, h.risk !== null && h.risk !== undefined ? `${h.risk}` : "…"));
    b.setAttribute("aria-label", `${t.flag[h.flag]} · ${h.title}`);
    b.addEventListener("click", () => {
      selectedId = h.scanId;
      void render();
    });
    list.append(el("li", {}, b));
  }
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[role='tab']"));
  const select = (tab: HTMLButtonElement) => {
    for (const x of tabs) {
      const on = x === tab;
      x.setAttribute("aria-selected", String(on));
      x.tabIndex = on ? 0 : -1;
      $(x.getAttribute("aria-controls")!).hidden = !on;
    }
    tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") select(tabs[(i + 1) % tabs.length]);
      if (e.key === "ArrowLeft") select(tabs[(i - 1 + tabs.length) % tabs.length]);
    });
  });
}

async function init() {
  settings = await getSettings();
  t = STRINGS[settings.lang];
  applyI18n();
  setupTabs();
  setupLangSwitch();
  $<HTMLInputElement>("server").value = settings.server;

  $("open-settings").addEventListener("click", () => {
    const panel = $("settings");
    panel.hidden = !panel.hidden;
    $("open-settings").setAttribute("aria-expanded", String(!panel.hidden));
  });
  $("save-settings").addEventListener("click", () => {
    const server = $<HTMLInputElement>("server").value.trim().replace(/\/$/, "");
    let valid = false;
    try {
      valid = /^https?:$/.test(new URL(server).protocol);
    } catch {
      valid = false;
    }
    if (!valid) return showError("not_found");
    const permission = chrome.permissions.request({ origins: [originPattern(server)] });
    void permission.then(async (granted) => {
      if (!granted) return showError("permission_denied");
      await saveSettings({ server });
      settings = await getSettings();
      t = STRINGS[settings.lang];
      applyI18n();
      renderConsent();
      $("settings-status").textContent = t.saved;
      await render();
    });
  });
  $("reset-token").addEventListener("click", () => void chrome.runtime.sendMessage({ type: "reset-token" }).then(() => ($("settings-status").textContent = t.saved)));

  // One-time consent for auto-submit (SPEC 12.2). Turning it off keeps the date of the original consent.
  $<HTMLInputElement>("auto-submit").addEventListener("change", (e) => {
    const on = (e.target as HTMLInputElement).checked;
    const patch = { autoSubmit: on, ...(on ? { consentAt: new Date().toISOString() } : {}) };
    void saveSettings(patch).then(async () => {
      settings = await getSettings();
      renderConsent();
    });
  });
  renderConsent();
  // Keep the Undo countdown accurate while the popup stays open.
  setInterval(() => void render(), 30_000);

  $("scan-open").addEventListener("click", () => {
    const permission = ensurePermission();
    busy("scan-open", true);
    void scanOpenEmail(permission).finally(() => busy("scan-open", false));
  });
  $("scan-sms").addEventListener("click", () => {
    const text = $<HTMLTextAreaElement>("sms-text").value.trim();
    if (!text) return showError("empty");
    const sender = $<HTMLInputElement>("sms-sender").value.trim() || undefined;
    void send({ kind: "sms", text, sender }, "scan-sms", ensurePermission());
  });
  $("scan-eml").addEventListener("click", () => {
    const file = $<HTMLInputElement>("eml-file").files?.[0];
    if (!file) return showError("unparseable_message");
    if (/\.msg$/i.test(file.name)) return showError("msg_unsupported");
    if (file.size > 2_000_000) return showError("file_too_large");
    const permission = ensurePermission();
    void file.text().then((raw) => send({ kind: "eml", raw, fileName: file.name }, "scan-eml", permission));
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.history || changes.current)) void render();
  });
  await render();
}

void init();
