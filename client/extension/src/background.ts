import { ApiError, authed, deleteSignal, submitSignal, toRequest, type Report, type ScanStatus } from "./lib/api";
import { FLAG_COLOR, flagFor, getHistory, getSettings, upsertHistory } from "./lib/config";
import { STRINGS } from "./lib/i18n";
import { autoMode, buildSignal, indicatorsOnly } from "./lib/signal";
import type { BgMessage, BgReply, ScanPayload, ScanSummary } from "./lib/types";

const errorCode = (e: unknown) => (e instanceof ApiError ? (e.code === "network" ? "server_unreachable" : e.code) : "unknown");

/**
 * Sends the stored signal report to the SOC inbox. `mode` "indicators" strips
 * subject, text and attachment names (yellow). Never sends twice.
 */
async function submitReport(scanId: string, mode: "full" | "indicators", auto: boolean): Promise<BgReply> {
  const s = (await getHistory()).find((h) => h.scanId === scanId);
  if (!s?.signal) return { ok: false, error: "not_ready" };
  if (s.submitted && !s.submitted.deleted) return { ok: true, scanId };
  const { server } = await getSettings();
  const signal = mode === "indicators" ? indicatorsOnly(s.signal) : s.signal;
  try {
    const r = await submitSignal(server, signal);
    await upsertHistory({ ...s, submitError: undefined, submitted: { ...r, indicatorsOnly: mode === "indicators", auto } });
    return { ok: true, scanId };
  } catch (e) {
    await upsertHistory({ ...s, submitError: errorCode(e) });
    return { ok: false, error: errorCode(e) };
  }
}

async function undoReport(scanId: string): Promise<BgReply> {
  const s = (await getHistory()).find((h) => h.scanId === scanId);
  if (!s?.submitted || s.submitted.deleted) return { ok: false, error: "not_found" };
  if (Date.parse(s.submitted.deleteUntil) < Date.now()) return { ok: false, error: "too_late" };
  try {
    await deleteSignal((await getSettings()).server, s.submitted.reportId);
    await upsertHistory({ ...s, submitted: { ...s.submitted, deleted: true } });
    return { ok: true, scanId };
  } catch (e) {
    return { ok: false, error: errorCode(e) };
  }
}

/**
 * Background worker (Chrome service worker / Firefox event page). Calls the
 * platform API, polls the scan, stores the summary, sets the badge and shows a
 * notification. Long scans keep going even when the popup closes.
 */

const POLL_MS = 1500;
const POLL_LIMIT_MS = 120_000;

function titleOf(p: ScanPayload): string {
  switch (p.kind) {
    case "email":
      return p.email.subject || p.email.sender || "Email";
    case "eml":
      return p.fileName;
    case "sms":
      return p.text.slice(0, 80);
    case "selection":
      return p.text.slice(0, 80);
  }
}

async function setBadge(tabId: number | undefined, s: ScanSummary) {
  const done = s.status === "completed" || s.status === "partial";
  const text = !done ? "…" : s.flag === "green" ? "✓" : s.flag === "yellow" ? "!" : "!!";
  const opts = tabId === undefined ? {} : { tabId };
  await chrome.action.setBadgeBackgroundColor({ color: FLAG_COLOR[s.flag], ...opts });
  await chrome.action.setBadgeText({ text, ...opts });
}

async function notify(s: ScanSummary) {
  const { lang } = await getSettings();
  const t = STRINGS[lang];
  const done = s.status === "completed" || s.status === "partial";
  try {
    await chrome.notifications.create(`scan-${s.scanId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: done ? `${t.flag[s.flag]} · ${s.risk ?? "–"}/100` : t.failed,
      message: done
        ? `${s.title}\n${s.vtMax ? t.vtEngines(s.vtMax) : t.verdict[s.verdict as keyof typeof t.verdict] ?? ""}${s.submitted ? `\n${t.sentNotice(s.submitted.protocol)}` : ""}`
        : (s.error ?? ""),
      priority: s.flag === "red" || s.flag === "darkred" ? 2 : 0,
    });
  } catch {
    // Notifications may be disabled by the user; the popup still shows the result.
  }
}

function summarise(base: ScanSummary, st: ScanStatus, report: Report | null): ScanSummary {
  const done = st.status === "completed" || st.status === "partial";
  const risk = report?.riskScore ?? st.riskScore;
  const vt = (report?.reputation.results ?? []).map((r) => ({
    type: r.type,
    value: r.value,
    malicious: r.malicious,
    suspicious: r.suspicious,
    found: r.found,
    label: r.threatLabel ?? r.categories[0] ?? null,
  }));
  return {
    ...base,
    channel: st.channel,
    status: st.status,
    progress: st.progress,
    stages: st.stages,
    verdict: report?.verdict ?? st.verdict,
    risk,
    severity: report?.severity ?? st.severity,
    flag: flagFor(risk, done),
    vtMax: vt.length ? Math.max(...vt.map((v) => v.malicious)) : null,
    vt: vt.slice(0, 6),
    reasons: (report?.evidence.engineReasons ?? [])
      .filter((r) => r.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((r) => ({ sq: r.text_sq, en: r.text_en, weight: r.weight })),
    types: report?.classification.phishingType.map((c) => c.value) ?? (st.phishingType ? [st.phishingType] : []),
    family: report?.classification.phishingFamily[0]?.value ?? st.phishingFamily,
    exfil: report?.exfil?.endpoints.slice(0, 3).map((e) => ({ kind: e.kind, value: e.value, otherScans: e.otherScans })),
    actions: report?.recommendedActions.slice(0, 4),
  };
}

async function runScan(payload: ScanPayload, tabId?: number): Promise<BgReply> {
  const { server, lang } = await getSettings();
  let created: { scanId: string };
  try {
    created = await authed<{ scanId: string }>(server, "/api/phishing-intelligence/scan", { method: "POST", body: JSON.stringify(toRequest(payload, lang)) });
  } catch (e) {
    return { ok: false, error: errorCode(e) };
  }

  let summary: ScanSummary = {
    scanId: created.scanId,
    title: titleOf(payload),
    channel: payload.kind === "sms" || (payload.kind === "selection" && payload.as === "sms") ? "SMS" : "EMAIL",
    status: "queued",
    progress: 0,
    flag: "grey",
    createdAt: new Date().toISOString(),
  };
  await upsertHistory(summary);
  await setBadge(tabId, summary);

  // Poll in the background; the popup follows along through storage.onChanged.
  void (async () => {
    const started = Date.now();
    while (Date.now() - started < POLL_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      let st: ScanStatus;
      try {
        st = await authed<ScanStatus>(server, `/api/phishing-intelligence/scans/${created.scanId}`);
      } catch {
        continue;
      }
      const done = st.status === "completed" || st.status === "partial";
      let report: Report | null = null;
      if (done) {
        try {
          report = await authed<Report>(server, `/api/phishing-intelligence/reports/${created.scanId}`);
        } catch {
          report = null;
        }
      }
      summary = summarise(summary, st, report);
      if (done && report && summary.flag !== "grey") {
        summary.signal = buildSignal(report, summary.flag, chrome.runtime.getManifest().version, "full");
      }
      await upsertHistory(summary);
      if (done || st.status === "failed") {
        // Auto-submit only after the user's one-time consent, and only by flag (SPEC 12.2).
        const { autoSubmit } = await getSettings();
        const mode = autoSubmit && summary.signal ? autoMode(summary.flag) : "none";
        if (mode !== "none") await submitReport(summary.scanId, mode, true);
        const latest = (await getHistory()).find((h) => h.scanId === summary.scanId) ?? summary;
        await setBadge(tabId, latest);
        await notify(latest);
        return;
      }
    }
    summary = { ...summary, status: "error", error: "timeout" };
    await upsertHistory(summary);
  })();

  return { ok: true, scanId: created.scanId };
}

chrome.runtime.onMessage.addListener((msg: BgMessage, sender, sendResponse: (r: BgReply) => void) => {
  if (msg.type === "scan") {
    void runScan(msg.payload, sender.tab?.id ?? undefined).then(sendResponse);
    return true;
  }
  if (msg.type === "report") {
    // Manual "Report to SOC": an explicit click is consent for this one report.
    void submitReport(msg.scanId, "full", false).then(sendResponse);
    return true;
  }
  if (msg.type === "undo-report") {
    void undoReport(msg.scanId).then(sendResponse);
    return true;
  }
  if (msg.type === "reset-token") {
    void chrome.storage.local.get(null).then(async (all) => {
      await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith("token:")));
      sendResponse({ ok: true, scanId: "" });
    });
    return true;
  }
  return false;
});

// Right-click on selected text in any webmail: scan it as an email body or as an SMS.
chrome.runtime.onInstalled.addListener(async () => {
  const { lang } = await getSettings();
  const t = STRINGS[lang];
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: "mburoja-email", title: t.menuEmail, contexts: ["selection"] });
  chrome.contextMenus.create({ id: "mburoja-sms", title: t.menuSms, contexts: ["selection"] });
});

// The popup's SQ | EN switch saves `lang`: relabel the right-click menu right away.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.lang) return;
  const t = STRINGS[(changes.lang.newValue as "sq" | "en" | undefined) ?? "sq"];
  // Callback form works in Chrome and Firefox; reading lastError silences "no such menu item".
  for (const [id, title] of [["mburoja-email", t.menuEmail], ["mburoja-sms", t.menuSms]] as const) {
    try { chrome.contextMenus.update(id, { title }, () => void chrome.runtime.lastError); } catch { /* menus not created yet */ }
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const text = (info.selectionText ?? "").trim();
  if (!text) return;
  void runScan({ kind: "selection", text, as: info.menuItemId === "mburoja-sms" ? "sms" : "email" }, tab?.id).then(async (r) => {
    if (!r.ok) {
      const { lang } = await getSettings();
      await chrome.notifications.create({ type: "basic", iconUrl: chrome.runtime.getURL("icons/icon-128.png"), title: "Mburoja", message: STRINGS[lang].errors[r.error as keyof (typeof STRINGS)["sq"]["errors"]] ?? r.error });
    }
  });
});

// Keep the badge in sync with the last result when the worker restarts.
chrome.runtime.onStartup.addListener(async () => {
  const last = (await getHistory())[0];
  if (last) await setBadge(undefined, last);
});
