import { h, svg } from "../content/dom";
import { API_URL } from "../lib/api";
import { FLAG_COLOR, FLAG_ICON, t, uiLocale } from "../lib/i18n";
import { getLast, getSent, getSettings, setSettings } from "../lib/settings";
import type { ExtractedEmail, ScanView } from "../lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (msg: string) => { $("status").textContent = msg; };

document.documentElement.lang = uiLocale();
document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n!); });
$("api").textContent = t("popupConnected", [new URL(API_URL).host]);
($("platform") as HTMLAnchorElement).href = `${API_URL}/${uiLocale()}/check`;

function ring(score: number, flag: string) {
  const c = 2 * Math.PI * 22;
  const label = svg("text", { x: "28", y: "33", "text-anchor": "middle", "font-size": "15", "font-weight": "700", fill: "currentColor" });
  label.textContent = String(score);
  return svg("svg", { width: "56", height: "56", viewBox: "0 0 56 56", role: "img", "aria-label": `${t("score")} ${score}/100` },
    svg("circle", { cx: "28", cy: "28", r: "22", fill: "none", stroke: "#e5e7eb", "stroke-width": "6" }),
    svg("circle", { cx: "28", cy: "28", r: "22", fill: "none", stroke: FLAG_COLOR[flag], "stroke-width": "6", "stroke-linecap": "round", "stroke-dasharray": `${(c * score) / 100} ${c}`, transform: "rotate(-90 28 28)" }),
    label);
}

function renderLast(v: ScanView | null) {
  const root = $("last");
  root.replaceChildren();
  if (!v) { root.append(h("p", { class: "muted" }, t("popupNoScan"))); return; }
  if (v.phase === "error") { root.append(h("div", { class: "card" }, `⚠ ${v.error ?? t("errServer")}`)); return; }
  const busy = v.phase !== "done";
  const report = v.report.state === "sent" ? `✓ ${t("sent")} · ${v.report.protocol}` : v.report.state === "below" ? t("belowThreshold", [String(v.threshold)]) : v.report.state === "needs_consent" ? t("reachedThreshold", [String(v.score), String(v.threshold)]) : v.report.state === "undone" ? t("undone") : "";
  root.append(h("div", { class: "card" },
    h("div", { class: "top" }, ring(v.score, v.flag), h("div", {},
      h("div", { class: "flag", style: `color:${FLAG_COLOR[v.flag]}` }, `${FLAG_ICON[v.flag]} ${t(`flag_${v.flag}`)}`),
      v.subject ? h("div", { class: "muted" }, v.subject) : null,
      h("div", { class: "muted" }, busy ? h("span", { class: "spin", "aria-hidden": "true" }) : null, " ", busy ? t("popupScanning", [String(v.progress)]) : new Date(v.at).toLocaleString()),
    )),
    busy ? h("div", { class: "bar", role: "progressbar", "aria-valuenow": String(v.progress), "aria-valuemin": "0", "aria-valuemax": "100" }, h("span", { style: `width:${v.progress}%` })) : null,
    busy ? h("ol", { class: "steps" }, ...(["read", "local", "engine", "intel", "report"] as const).map((k) => h("li", { class: v.steps[k] }, t(`step_${k}`)))) : null,
    v.reasons.length ? h("ul", {}, ...v.reasons.map((r) => h("li", {}, r.text))) : null,
    report ? h("p", { class: "muted" }, report) : null,
  ));
}

async function renderSent() {
  const list = $("sent");
  list.replaceChildren();
  const sent = await getSent();
  if (!sent.length) { list.append(h("li", { class: "muted" }, t("popupNoSent"))); return; }
  for (const s of sent.slice(0, 8)) {
    const canUndo = !s.undone && Date.parse(s.deleteUntil) > Date.now();
    list.append(h("li", {},
      h("span", {}, h("code", {}, s.protocol), " ", h("span", { class: "muted" }, s.undone ? t("undone") : `${FLAG_ICON[s.flag]} ${s.score} · ${new Date(s.at).toLocaleTimeString()}`)),
      canUndo ? h("button", { class: "btn ghost small", type: "button", onclick: async () => {
        const r = await chrome.runtime.sendMessage({ type: "undo", reportId: s.reportId });
        status(r?.ok ? t("undone") : r?.error ?? t("errServer"));
        void renderSent();
      } }, t("undo")) : null,
    ));
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

$("scan-email").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return;
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: "trigger" });
    if (r?.ok) window.close();
    else status(t("noEmailOpen"));
  } catch {
    status(t("popupNotGmail"));
  }
});

$("scan-page").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) { status(t("popupCannotScanPage")); return; }
  status(t("reading"));
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ url: location.href, title: document.title, selection: getSelection()?.toString() ?? "" }) });
    const page = result as { url: string; title: string; selection: string };
    const email: ExtractedEmail = { client: "page", subject: page.title, text: page.selection.slice(0, 5000), links: [{ href: page.url, text: "" }], attachments: [] };
    const view = await chrome.runtime.sendMessage({ type: "scan-page", email, tabId: tab.id });
    status("");
    renderLast(view);
  } catch {
    status(t("popupCannotScanPage"));
  }
});

const auto = $("auto") as HTMLInputElement;
const deep = $("deep") as HTMLInputElement;
deep.addEventListener("change", () => void setSettings({ deepScan: deep.checked }));
const threshold = $("threshold") as HTMLSelectElement;
auto.addEventListener("change", () => void setSettings({ autoSubmit: auto.checked }));
threshold.addEventListener("change", () => void setSettings({ threshold: Number(threshold.value) as 40 | 60 | 80 }));

(async () => {
  const s = await getSettings();
  auto.checked = s.autoSubmit;
  deep.checked = s.deepScan;
  threshold.value = String(s.threshold);
  renderLast(await getLast());
  await renderSent();
})();

// Live updates while a scan runs in the Gmail tab.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.last) renderLast((changes.last.newValue as ScanView | undefined) ?? null);
  if (changes.sent) void renderSent();
});
