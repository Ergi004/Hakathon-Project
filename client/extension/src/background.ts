import { analyzeLocal } from "./lib/analyze-local";
import { api, ApiError, type IntelSnapshot, VERSION } from "./lib/api";
import { FLAG_COLOR, t, uiLocale } from "./lib/i18n";
import { combineScore, decide, emailFacts, progressOf, providerDetail, toAnalysisInput, toSignals, topReasons } from "./lib/pipeline";
import { addSent, getSettings, markUndone, setLast, setSettings } from "./lib/settings";
import type { ExtractedEmail, IntelDomain, ScanView, StepKey, ToBackground, ToContent } from "./lib/types";

const POLL_MS = 1500;
const MAX_WAIT_MS = 50_000;
const MAX_WAIT_DEEP_MS = 120_000;
const COUNTDOWN_MS = 5000;
const TIER_A = ["internal", "dns", "rdap", "urlhaus", "crtsh", "virustotal"];

interface Session { email: ExtractedEmail | null; view: ScanView | null; alive: boolean; tabId?: number; cancel?: () => void; post: (v: ScanView) => void }

function badge(tabId: number | undefined, view: ScanView) {
  if (tabId === undefined) return;
  const busy = view.phase !== "done" && view.phase !== "error";
  void chrome.action.setBadgeBackgroundColor({ tabId, color: busy ? "#0d9488" : FLAG_COLOR[view.flag] ?? "#6b7280" });
  void chrome.action.setBadgeText({ tabId, text: view.phase === "error" ? "?" : busy ? `${view.progress}%`.slice(0, 4) : String(view.score) });
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return t("errOffline");
    if (e.status === 429) return t("errRateLimited");
    return `${t("errServer")} (${e.code})`;
  }
  return t("errServer");
}

const tr = (k: string, sub?: string[]) => t(k, sub);

function step(v: ScanView, key: StepKey, state: ScanView["steps"][StepKey]) {
  v.steps[key] = state;
  v.progress = progressOf(v);
}

function applySnapshot(d: IntelDomain, snap: IntelSnapshot) {
  d.status = snap.scan.status;
  d.domainAgeDays = snap.scan.domainAgeDays;
  d.finalScore = snap.scan.finalScore;
  d.subdomains = snap.subdomains.length;
  d.rows = snap.results.map((r) => ({
    key: r.key,
    provider: r.provider,
    tier: r.tier,
    status: r.status,
    verdict: r.verdict,
    detail: providerDetail(r.provider, r.status, r.summary ?? {}, { malicious: r.maliciousCount, total: r.totalCount }, tr),
  }));
}

async function submit(s: Session) {
  if (!s.email || !s.view) return;
  const view = s.view;
  view.report = { state: "sending" };
  step(view, "report", "active");
  s.post(view);
  try {
    const r = await api.report(toSignals(s.email, view, VERSION));
    view.report = { state: "sent", protocol: r.protocol, reportId: r.reportId, deleteUntil: r.deleteUntil };
    await addSent({ reportId: r.reportId, protocol: r.protocol, at: new Date().toISOString(), deleteUntil: r.deleteUntil, score: view.score, flag: view.flag, subject: view.subject });
    step(view, "report", "done");
  } catch (e) {
    view.report = { state: "failed", error: errorText(e) };
    step(view, "report", "error");
  }
  view.phase = "done";
  view.finishedAt = new Date().toISOString();
  s.post(view);
}

/** Auto-submit after a visible 5-second countdown the user can cancel. */
function countdown(s: Session) {
  const view = s.view!;
  view.report = { state: "countdown", submitAt: new Date(Date.now() + COUNTDOWN_MS).toISOString() };
  step(view, "report", "active");
  s.post(view);
  const timer = setTimeout(() => { s.cancel = undefined; void submit(s); }, COUNTDOWN_MS);
  s.cancel = () => {
    clearTimeout(timer);
    s.cancel = undefined;
    view.report = { state: "cancelled" };
    step(view, "report", "skipped");
    view.phase = "done";
    view.finishedAt = new Date().toISOString();
    s.post(view);
  };
}

async function runScan(s: Session, email: ExtractedEmail) {
  s.cancel?.();
  const locale = uiLocale();
  const settings = await getSettings();
  s.email = email;
  const now = new Date().toISOString();

  // 1-2. Reading done in the page; instant on-device rules.
  const local = analyzeLocal(email, (k, sub) => t(k, sub));
  const view: ScanView = {
    id: crypto.randomUUID(),
    phase: "engine",
    steps: { read: "done", local: "done", engine: "active", intel: "pending", report: "pending" },
    progress: 0,
    startedAt: now,
    preliminary: true,
    score: local.score,
    flag: local.flag,
    reasons: local.reasons,
    found: emailFacts(email),
    intel: { mock: false, deep: settings.deepScan, domains: [] },
    report: { state: "none" },
    threshold: settings.threshold,
    subject: email.subject ? email.subject.slice(0, 140) : undefined,
    at: now,
  };
  view.progress = progressOf(view);
  s.view = view;
  s.post(view);

  // 3. The platform's detection engine (same as the website).
  let res;
  try {
    res = await api.scan(toAnalysisInput(email, locale), { deep: settings.deepScan && email.client !== "page" });
  } catch (e) {
    view.phase = "error";
    view.error = errorText(e);
    step(view, "engine", "error");
    s.post(view);
    return;
  }
  Object.assign(view, { preliminary: false, score: res.score, baseScore: res.score, flag: res.flag, reasons: topReasons(res.reasons, locale), groups: res.groups, explanation: res.explanation });
  step(view, "engine", "done");

  // 4. Live threat intelligence on every link domain (VirusTotal, URLhaus, RDAP, crt.sh, DNS, Hybrid Analysis).
  const scans = res.scans ?? (res.scan ? [{ ...res.scan, host: "" }] : []);
  if (scans.length) {
    view.phase = "intel";
    view.intel.domains = scans.map((sc) => ({
      host: sc.host, status: "running", domainAgeDays: null, finalScore: null, subdomains: 0,
      rows: TIER_A.map((p) => ({ key: `A:${p}`, provider: p, tier: "A" as const, status: "pending", verdict: "unknown" })),
    }));
    step(view, "intel", "active");
    s.post(view);
    const base = { score: res.score, flag: res.flag };
    const started = Date.now();
    const limit = settings.deepScan ? MAX_WAIT_DEEP_MS : MAX_WAIT_MS;
    const done = new Set<number>();
    while (done.size < scans.length && Date.now() - started < limit) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      await Promise.all(scans.map(async (sc, i) => {
        if (done.has(i)) return;
        try {
          const snap = await api.intel(sc.scanId, sc.token);
          applySnapshot(view.intel.domains[i], snap);
          if (!view.intel.domains[i].host) view.intel.domains[i].host = snap.scan.host;
          view.intel.mock ||= snap.scan.mock;
          if (snap.scan.status !== "running") done.add(i);
        } catch {
          view.intel.domains[i].status = "error";
          view.intel.domains[i].error = t("errIntel");
          done.add(i);
        }
      }));
      const best = Math.max(...view.intel.domains.map((d) => d.finalScore ?? 0));
      Object.assign(view, combineScore(base, best));
      view.progress = progressOf(view);
      s.post(view);
    }
    // Anything still pending after the time limit is shown as "still running on the platform".
    for (const d of view.intel.domains) if (d.status === "running") d.status = "timeout";
    step(view, "intel", "done");
  } else {
    step(view, "intel", "skipped");
  }

  // 5. Decide: report to the authorities when the final score reaches the threshold.
  view.phase = "report";
  const decision = email.client === "page" ? "below" : decide(view.score, view.flag, settings.threshold, settings.autoSubmit);
  if (decision === "submit") return countdown(s);
  view.report = { state: decision };
  step(view, "report", decision === "below" ? "skipped" : "active");
  if (decision === "below") {
    view.phase = "done";
    view.finishedAt = new Date().toISOString();
  }
  s.post(view);
}

// Overlay in Gmail / Outlook: one port per tab.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "mburoja") return;
  const s: Session = {
    email: null,
    view: null,
    alive: true,
    tabId: port.sender?.tab?.id,
    post: (v) => {
      void setLast(v);
      badge(s.tabId, v);
      if (s.alive) port.postMessage({ type: "view", view: structuredClone(v) } satisfies ToContent);
    },
  };
  port.onDisconnect.addListener(() => { s.alive = false; });
  port.onMessage.addListener(async (msg: ToBackground) => {
    if (msg.type === "scan") await runScan(s, msg.email);
    else if (msg.type === "cancel") s.cancel?.();
    else if (msg.type === "report") {
      if (msg.always) await setSettings({ autoSubmit: true });
      await submit(s);
    } else if (msg.type === "undo" && s.view?.report.reportId) {
      try {
        await api.undo(s.view.report.reportId);
        await markUndone(s.view.report.reportId);
        s.view.report = { ...s.view.report, state: "undone" };
      } catch (e) {
        s.view.report = { ...s.view.report, error: errorText(e) };
      }
      s.post(s.view);
    }
  });
});

// Popup: scan the current page, undo from the history list.
chrome.runtime.onMessage.addListener((msg: { type: string; email?: ExtractedEmail; tabId?: number; reportId?: string }, _sender, reply) => {
  if (msg.type === "scan-page" && msg.email) {
    let last: ScanView | null = null;
    const s: Session = { email: null, view: null, alive: false, tabId: msg.tabId, post: (v) => { last = v; void setLast(v); badge(msg.tabId, v); } };
    runScan(s, msg.email).then(() => reply(last));
    return true;
  }
  if (msg.type === "undo" && msg.reportId) {
    api.undo(msg.reportId).then(() => markUndone(msg.reportId!)).then(() => reply({ ok: true }), (e) => reply({ ok: false, error: errorText(e) }));
    return true;
  }
  return false;
});
